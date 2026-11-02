import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import axios from 'axios';
import App from './App';

jest.mock('axios', () => jest.fn());
jest.mock('material-ui-dropzone', () => ({
  DropzoneArea: ({ onChange }) => (
    <button onClick={() => onChange([new File(['dog'], 'dog.jpg', { type: 'image/jpeg' })])}>
      Select dog
    </button>
  ),
}));

let container;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  URL.createObjectURL = jest.fn(() => 'blob:dog');
  URL.revokeObjectURL = jest.fn();
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  container.remove();
});

async function upload() {
  await act(async () => {
    Simulate.click(container.querySelector('button'));
  });
}

test('renders the dog photo upload screen', () => {
  act(() => { ReactDOM.render(<App />, container); });
  expect(container.textContent).toContain('Dog Breed Recognition');
  expect(container.textContent).toContain('Select dog');
});

test('uploads a dog photo and displays three breed scores', async () => {
  axios.mockResolvedValue({ data: { status: 'ok', class: 'Golden retriever', confidence: 0.65, predictions: [{ class: 'Golden retriever', confidence: 0.65 }, { class: 'Labrador retriever', confidence: 0.2 }, { class: 'Beagle', confidence: 0.1 }], message: 'Visual breed estimates can be uncertain.' } });
  act(() => { ReactDOM.render(<App />, container); });
  await upload();
  expect(axios.mock.calls[0][0].data.get('file').name).toBe('dog.jpg');
  expect(container.textContent).toContain('Golden retriever');
  expect(container.textContent).toContain('65.00%');
  expect(container.textContent).toContain('Labrador retriever');
  expect(container.textContent).toContain('Beagle');
  expect(container.textContent).toContain('20.00%');
  expect(container.textContent).toContain('10.00%');
  const clear = Array.from(container.querySelectorAll('[role="button"],button'))
    .find(node => node.textContent === 'Clear');
  act(() => Simulate.click(clear));
  expect(container.textContent).toContain('Select dog');
  expect(container.textContent).not.toContain('Golden retriever');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dog');
});

test('shows an API failure and lets the user clear and retry', async () => {
  axios.mockRejectedValue({ response: { data: { detail: 'Upload a valid image.' } } });
  act(() => { ReactDOM.render(<App />, container); });
  await upload();
  expect(container.querySelector('[role="alert"]').textContent).toBe('Upload a valid image.');
  expect(container.textContent).not.toContain('Finding breed matches');
  expect(container.textContent).toContain('Clear');
});

test('ignores a prediction that completes after Clear', async () => {
  let resolve;
  axios.mockReturnValue(new Promise(done => { resolve = done; }));
  act(() => { ReactDOM.render(<App />, container); });
  await upload();
  expect(container.textContent).toContain('Finding breed matches');
  const clear = Array.from(container.querySelectorAll('[role="button"],button'))
    .find(node => node.textContent === 'Clear');
  act(() => Simulate.click(clear));
  await act(async () => resolve({ data: { class: 'Beagle', confidence: 0.99 } }));
  expect(container.textContent).not.toContain('Beagle');
  expect(container.textContent).toContain('Select dog');
});


test('shows a non-dog response without breed matches', async () => {
  axios.mockResolvedValue({ data: {
    status: 'no_dog_detected', class: null, confidence: null, predictions: [],
    message: 'No dog recognized. Try a clear photo of one dog, filling the frame.',
  } });
  act(() => { ReactDOM.render(<App />, container); });
  await upload();
  expect(container.textContent).toContain('No dog recognized');
  expect(container.textContent).not.toContain('Top breed matches');
  expect(container.textContent).not.toContain('NaN');
});

test('shows the model setup error returned by the API', async () => {
  axios.mockRejectedValue({ response: { status: 503, data: { detail: 'Dog breed model is not installed.' } } });
  act(() => { ReactDOM.render(<App />, container); });
  await upload();
  expect(container.querySelector('[role="alert"]').textContent).toContain('Dog breed model is not installed.');
});
