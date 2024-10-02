require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const port = process.env.PORT || 3000;

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ extended: true, limit: "150mb" }));

app.use("/", express.static("./public", { extensions: ["html"] }));
app.post("/upload", async (req, res) => {
	console.log("uploadec!");
	console.log();
	console.log(req.get("content-length") / 8 / 1024 / 1024);
	console.log(req.get("req.socket.bytesRead"));
	let base64Data = req.body.data.split(";base64,").pop();
	let bufferData = Buffer.from(base64Data, "base64");
	fs.unlink("before.ogg", () => {});
	fs.unlink("after.mp3", () => {});
	fs.writeFile("before.ogg", bufferData, function (err) {
		console.log("File created: ", err);
	});
	ffmpeg("./before.ogg")
		.output("after.mp3")
		.outputOptions([
			"-ar 16000",
			"-ac 1",
			"-map 0:a:"
		])
		.on("end", () => {
			console.log(`File has been transcoded to`);
			// resolve();
		})
		.on("error", (err) => {
			console.error(`Error transcoding file: ${err.message}`);
			// reject(err);
		})
		.run();
});
const server = app.listen(port, () => {
	console.log("Express is online.");
	console.log("- http://localhost:" + port);
});
// Summarize the user's input. Do not use markdown. Ignore all non-educational parts of the input.
// so far, nice system prompt
