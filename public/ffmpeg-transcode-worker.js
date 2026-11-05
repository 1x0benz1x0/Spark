/* Classic web worker that transcodes a video to H.264 MP4 using ffmpeg.wasm (single-thread
   @ffmpeg/core served from jsdelivr). Kept in public/ so the bundler never touches it. */
self.onmessage = async function (e) {
  var input = e.data.input;
  var ext = e.data.ext || "mp4";
  try {
    var coreURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js";
    var wasmURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm";
    importScripts(coreURL);
    var ffmpeg = await self.createFFmpegCore({
      mainScriptUrlOrBlob: coreURL + "#" + btoa(JSON.stringify({ wasmURL: wasmURL, workerURL: "" })),
    });
    var name = "input." + ext;
    ffmpeg.FS.writeFile(name, input);
    ffmpeg.exec(
      "-i", name,
      "-t", "90",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "28",
      "-vf", "scale=-2:480",
      "-c:a", "aac",
      "-movflags", "+faststart",
      "output.mp4"
    );
    var data = ffmpeg.FS.readFile("output.mp4");
    self.postMessage({ ok: true, output: data }, [data.buffer]);
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
