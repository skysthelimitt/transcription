require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const Groq = require("groq-sdk");
const groq = new Groq();
const { parse } = require("node-html-parser")

const port = process.env.PORT || 3000;

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ extended: true, limit: "150mb" }));
let index = '<!DOCTYPE html><html lang="en"><head><title>Website</title><link rel="stylesheet" href="style.css"></head><body>{{ sections }}</body></html>';
let section = '<div class="section"><p>{{ time }}</p><audio controls><source src="{{ audio_file }}"></audio><div class="samerow"><textarea readonly>{{ transcript }}</textarea><textarea readonly>{{ summary }}</textarea></div></div>';

app.use("/", express.static("./public", { extensions: ["html"] }));
app.use("/audio/:dir/audio.mp3", async (req, res) => {
	console.log(req.params.dir);
	if(fs.existsSync(`./outputs/${req.params.dir}/groq-quality.mp3`)) {
		res.sendFile(__dirname + `/outputs/${req.params.dir}/groq-quality.mp3`);
	} else {
		res.sendStatus(404)
	}
});
app.use("/transcript/:dir", async (req, res) => {
	console.log(req.params.dir);
	if(fs.existsSync(`./outputs/${req.params.dir}/transcript.txt`)) {
		res.sendFile(__dirname + `/outputs/${req.params.dir}/transcript.txt`);
	} else {
		res.sendStatus(404)
	}
});
app.use("/summary/:dir", async (req, res) => {
	console.log(req.params.dir);
	if(fs.existsSync(`./outputs/${req.params.dir}/summary.txt`)) {
		res.sendFile(__dirname + `/outputs/${req.params.dir}/summary.txt`);
	} else {
		res.sendStatus(404)
	}
});

app.use("/list", async (req, res) => {
	fs.readdir("./outputs", (err, files) => {
		let sorted = files;
		sorted.sort(function (a, b) {
			return b - a;
		});
		console.log(sorted);
		sorted.forEach((file) => {
			console.log(file);
			console.log(
				new Date(Number(file)).toLocaleString("en-US", {
					timeZone: "America/New_York",
				})
			);
		});
	});
});
app.post("/upload", async (req, res) => {
	let randomNum = "-" + Math.round(Math.random() * 100000);
	console.log(req.get("content-length") / 8 / 1024 / 1024);
	let base64Data = req.body.data.split(";base64,").pop();
	let bufferData = Buffer.from(base64Data, "base64");
	await fs.writeFile(`./temp/before${randomNum}.ogg`, bufferData, function (err) {
		console.log("File created: ", err);
	});
	let date = new Date().valueOf();
	await fs.mkdir(`./outputs/${date}`, () => {});
	ffmpeg(`./temp/before${randomNum}.ogg`)
		.output(`./outputs/${date}/groq-quality.mp3`)
		.outputOptions(["-ar 16000", "-ac 1", "-map 0:a:"])
		.on("end", async () => {
			console.log(`File has been processed`);
			fs.unlink(`./temp/before${randomNum}.ogg`, () => {});
			const transcription = await groq.audio.transcriptions.create({
				file: fs.createReadStream(`./outputs/${date}/groq-quality.mp3`),
				model: "distil-whisper-large-v3-en",
				response_format: "verbose_json",
			});
			await fs.writeFile(`./outputs/${date}/transcript.txt`, transcription.text, function (err) {
				console.log("File created: ", err);
			});
			const chatCompletion = await groq.chat.completions.create({
				messages: [
					{
						role: "system",
						content: "Summarize the following lesson transcript in order to keep the most content possible whilst still being concise. Do not use markdown.",
					},
					{
						role: "user",
						content: transcription.text,
					},
				],
				model: "llama3-8b-8192",
				stream: false,
			});
			console.log(chatCompletion.choices[0].message.content);
			await fs.writeFile(`./outputs/${date}/summary.txt`, chatCompletion.choices[0].message.content, function (err) {
				console.log("File created: ", err);
			});
			res.sendStatus(200);
		})
		.on("error", (err) => {
			console.error(`Error transcoding file: ${err.message}`);
		})
		.run();
});
app.use("/view", async (req, res) => {
	fs.readdir("./outputs", (err, files) => {
		let sorted = files;
		sorted.sort(function (a, b) {
			return b - a;
		});
		let sections = "";
		sorted.forEach((file) => {
			let string = section;
			string = string.replace("{{ time }}", new Date(Number(file)).toLocaleString("en-US", {
				timeZone: "America/New_York",
			}));
			string = string.replace("{{ audio_file }}", `/audio/${Number(file)}/audio.mp3`);
			string = string.replace("{{ transcript }}", fs.readFileSync(`./outputs/${Number(file)}/transcript.txt`));
			string = string.replace("{{ summary }}", fs.readFileSync(`./outputs/${Number(file)}/summary.txt`));
			sections += string;
		});
		res.send(index.replace("{{ sections }}", sections))
	});
});
const server = app.listen(port, () => {
	console.log("Express is online.");
	console.log("- http://localhost:" + port);
});