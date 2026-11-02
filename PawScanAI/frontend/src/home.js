import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  AppBar, Toolbar, Typography, Container, Card, CardContent, CardMedia,
  Table, TableBody, TableHead, TableRow, TableCell, Button, CircularProgress,
} from "@material-ui/core";
import { DropzoneArea } from "material-ui-dropzone";
import axios from "axios";
import Pets from "@material-ui/icons/Pets";
import brandArt from "./pawscan.png";
import mascots from "./pawscan-mascots.png";

const useStyles = makeStyles((theme) => ({
  appbar: { background: "#FFF9EF", color: "#4B2B22", boxShadow: "none", borderBottom: "1px solid #EEDCC8" },
  toolbar: { maxWidth: 1000, width: "100%", boxSizing: "border-box", margin: "auto", gap: 12, paddingTop: 12, paddingBottom: 12 },
  brandIcon: { width: 46, height: 46, borderRadius: 15 },
  brandName: { fontWeight: 800, letterSpacing: -0.5 },
  brandCaption: { color: "#796354", fontSize: 11 },
  headerPaw: { marginLeft: "auto", color: "#BB430D", background: "#FFF0DF", borderRadius: 15, padding: 10 },
  main: { paddingTop: theme.spacing(4), paddingBottom: theme.spacing(5) },
  intro: { marginBottom: 26, padding: 26, borderRadius: 28, background: "#FFE8A5", display: "flex", alignItems: "center", gap: 12, overflow: "hidden" },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: "#BB430D", fontSize: 10, letterSpacing: 1.2, fontWeight: 800, marginBottom: 12 },
  heroTitle: { fontWeight: 800, letterSpacing: -1, color: "#4B2B22", fontSize: 36, lineHeight: 1.15, marginBottom: 12 },
  heroText: { color: "#74513A", fontSize: 14, lineHeight: 1.6 },
  breedPill: { display: "inline-block", background: "#FFF6D9", borderRadius: 24, padding: "8px 12px", color: "#4B2B22", fontSize: 11, fontWeight: 700, marginTop: 16 },
  heroArt: { width: "45%", maxWidth: 220, transform: "rotate(5deg)", marginRight: -12 },
  sectionTitle: { color: "#4B2B22", fontSize: 21, fontWeight: 800, marginBottom: 5 },
  sectionSubtitle: { color: "#796354", fontSize: 13, marginBottom: 18 },
  card: { borderRadius: 26, overflow: "hidden", boxShadow: "0 8px 30px #5b321009", border: "1px solid #EEDCC8" },
  media: { width: "100%", maxHeight: 380, objectFit: "contain", background: "#FFF0DF" },
  detail: { padding: theme.spacing(3) },
  loading: { display: "flex", alignItems: "center", gap: 16, color: "#BB430D" },
  note: { marginTop: theme.spacing(2), color: "#796354", fontSize: 12, lineHeight: 1.7 },
  tip: { background: "#FFF0CC", borderRadius: 20, padding: 18, marginTop: 18, color: "#74513A", fontSize: 13, lineHeight: 1.6 },
  clear: { marginTop: theme.spacing(2), color: "#BB430D", borderColor: "#E6BB8C", borderRadius: 16, padding: 13, textTransform: "none", fontWeight: 700 },
  resultTitle: { color: "#4B2B22", fontWeight: 800, fontSize: 23 },
  table: { "& th, & td": { paddingLeft: 0, paddingRight: 0, paddingTop: 12, paddingBottom: 12, borderColor: "#F3E7D8", color: "#4B2B22" } },
  score: { color: "#BB430D !important", fontWeight: 800 },
  barTrack: { height: 5, borderRadius: 5, background: "#F6EBDD", marginTop: 8, width: "90%", overflow: "hidden" },
  bar: { height: "100%", borderRadius: 5, background: "#D66620" },
  noDog: { padding: 10, textAlign: "center", color: "#4B2B22" },
  [theme.breakpoints.down('xs')]: {
    intro: { padding: 20 }, heroTitle: { fontSize: 29 }, heroText: { fontSize: 12 },
  },
}));

export const ImageUpload = () => {
  const classes = useStyles();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearData = () => {
    setSelectedFile(null);
    setPreview(undefined);
    setData(null);
    setError(null);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!selectedFile) return;
    const objectUrl = URL.createObjectURL(selectedFile);
    const controller = new AbortController();
    let active = true;
    setPreview(objectUrl);
    setIsLoading(true);
    setError(null);
    const sendFile = async () => {
      const formData = new FormData();
      formData.append("file", selectedFile);
      try {
        const response = await axios({
          method: "post", url: process.env.REACT_APP_API_URL || "/predict",
          data: formData, signal: controller.signal, timeout: 60000,
        });
        if (active) setData(response.data);
      } catch (err) {
        if (active) {
          const detail = err.response?.data?.detail;
          setError(typeof detail === "string" ? detail : "Could not process the image. Please try again.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    sendFile();
    return () => {
      active = false;
      controller.abort();
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const onSelectFile = (files) => {
    if (!files?.length) {
      clearData();
      return;
    }
    setError(null);
    setData(null);
    setSelectedFile(files[0]);
  };

  return (
    <>
      <AppBar position="static" className={classes.appbar}>
        <Toolbar className={classes.toolbar}>
          <img src={brandArt} className={classes.brandIcon} alt="PawScan AI dogs" />
          <div><Typography variant="h6" className={classes.brandName}>PawScan AI</Typography>
            <Typography className={classes.brandCaption}>Dog Breed Recognition</Typography></div>
          <Pets className={classes.headerPaw} aria-hidden="true" />
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" className={classes.main} component="main">
        <div className={classes.intro}>
          <div className={classes.heroCopy}>
            <Typography className={classes.eyebrow}>HELLO, DOG PERSON</Typography>
            <Typography component="h1" className={classes.heroTitle}>Who’s that<br />good dog?</Typography>
            <Typography className={classes.heroText}>Find your pup’s breed lookalikes,<br />one snap at a time.</Typography>
            <span className={classes.breedPill}>118 breed categories to explore</span>
          </div>
          <img src={mascots} className={classes.heroArt} alt="Corgi, golden retriever and husky mascots" />
        </div>
        <Typography component="h2" className={classes.sectionTitle}>Let’s meet your pup</Typography>
        <Typography className={classes.sectionSubtitle}>One photo. Three paw-sibilities.</Typography>
        <Card className={classes.card}>
          {selectedFile ? (
            <CardMedia className={classes.media} image={preview} component="img" alt="Selected dog" />
          ) : (
            <CardContent>
              <DropzoneArea
                Icon={Pets} acceptedFiles={["image/*"]} filesLimit={1} maxFileSize={10 * 1024 * 1024}
                dropzoneText="Your best friend goes here. Drop a photo or click to choose one."
                onChange={onSelectFile}
              />
              <Typography variant="body2" className={classes.note}>JPG, PNG or WebP · Up to 10 MiB</Typography>
            </CardContent>
          )}
          {isLoading && <CardContent className={classes.loading} role="status">
            <CircularProgress size={28} color="inherit" />
            <Typography>Finding breed matches…</Typography>
          </CardContent>}
          {error && <CardContent><Typography role="alert" color="error">{error}</Typography></CardContent>}
          {data && <CardContent className={classes.detail} aria-live="polite">
            {data.status === "no_dog_detected" ? (
              <div className={classes.noDog}><Typography component="h2" className={classes.sectionTitle}>Let’s give it another sniff</Typography><Typography role="status">{data.message}</Typography></div>
            ) : (
              <>
                <Typography className={classes.resultTitle} component="h2" gutterBottom>Top breed matches</Typography>
                <Table size="small" className={classes.table} aria-label="Dog breed predictions">
                  <TableHead><TableRow>
                    <TableCell>Breed</TableCell><TableCell align="right">Prediction score</TableCell>
                  </TableRow></TableHead>
                  <TableBody>{data.predictions.map((prediction) => (
                    <TableRow key={prediction.class}>
                      <TableCell component="th" scope="row">{prediction.class}
                        <div className={classes.barTrack} aria-hidden="true"><div className={classes.bar} style={{ width: `${Math.max(0, Math.min(100, prediction.confidence * 100))}%` }} /></div>
                      </TableCell>
                      <TableCell align="right" className={classes.score}>{(prediction.confidence * 100).toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
                <Typography variant="body2" className={classes.note}>{data.message}</Typography>
              </>
            )}
          </CardContent>}
        </Card>
        {selectedFile && <Button variant="outlined" fullWidth className={classes.clear} onClick={clearData}>
          Clear
        </Button>}
        {!selectedFile && <div className={classes.tip}><strong>A little photo tip</strong><br />One dog, good light, and those adorable ears in the frame.</div>}
        <Typography variant="body2" className={classes.note}>
          Every pup is one of a kind. These are visual estimates among supported breeds, not a guarantee of ancestry.
        </Typography>
      </Container>
    </>
  );
};
