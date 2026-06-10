window.BlobBuilder =
  window.MozBlobBuilder || window.WebKitBlobBuilder || window.BlobBuilder;

class Uploader {
  inputFile;
  blob;
  start;
  end;
  num;
  part;
  SIZE;
  size;
  fileSize = 0;
  BYTES_PER_CHUNK;
  NUM_CHUNKS;
  chunk;
  chunk_size = 0;
  xhr;
  counter = 0;
  socket = undefined;

  constructor(reference) {
    this.reference = reference;
    this.inputFile = this.reference.querySelector("input[type='file']");
    this.uploadButton = this.reference.querySelector(".js-upload");
    this.bindInputFile();
    this.bindUploadButton();
    this.initSocket()
  }

  initSocket() {
    this.socket = io("http://localhost:8080/")
    let user_id = localStorage.getItem("user_id")
    if (!user_id) {
      this.socket.emit("generate_id")
    } else {
      this.socket.emit("reconnect", user_id)
    }

    this.socket.on("user_id", (user_id) => {
      localStorage.setItem("user_id", user_id)
    })

    this.socket.on("no_user", () => {
      this.socket.emit("reconnect", user_id)
    })
  }

  bindInputFile() {
    this.inputFile.addEventListener("change", () => {
      this.fileSelected();
    });
  }

  fileSelected() {
    const file = this.inputFile.files[0];

    if (file) {
      if (file.size > 1024 * 1024) {
        this.fileSize =
          (Math.round((file.size * 100) / (1024 * 1024)) / 100).toString() +
          "MB";
      } else {
        this.fileSize =
          (Math.round((file.size * 100) / 1024) / 100).toString() + "KB";
      }

      document.getElementById("fileName").innerHTML = "Name: " + file.name;
      document.getElementById("fileSize").innerHTML = "Size: " + this.fileSize;
      document.getElementById("fileType").innerHTML = "Type: " + file.type;
    }
  }

  bindUploadButton() {
    this.uploadButton.addEventListener("click", () => {
      this.sendRequest();
    });
  }

  sendRequest() {
    const blob = this.inputFile.files[0];
    // blob = new Blob(blob_1, {type: 'video/mp4'});
    this.BYTES_PER_CHUNK = 10 * 1024 * 8; // 10MB chunk sizes.
    this.SIZE = blob.size;
    this.start = 0;
    this.end = this.BYTES_PER_CHUNK;
    this.part = 0;
    this.NUM_CHUNKS = Math.max(Math.ceil(this.SIZE / this.BYTES_PER_CHUNK), 1);



    // while (this.start < this.SIZE) {
    //   const chunk = blob.slice(this.start, this.end);
    //   this.socket.emit("metadata", JSON.stringify({ filename: blob.name, size: this.SIZE, chunk_count: NUM_CHUNKS }))
    //   this.uploadFile(chunk, this.part);
    //   this.start = this.end;
    //   this.end = this.start + this.BYTES_PER_CHUNK;
    //   this.part++;
    //   this.counter++;
    // }
    this.sendChunk(blob)
    this.socket.on("chunk:ok", ()=> {this.sendChunk(blob)})
  }

  async sendChunk(blob) {
    const chunk = blob.slice(this.start, this.end);
    const chunk_text = await chunk.text()
    this.socket.emit("metadata", JSON.stringify({ filename: blob.name, size: this.SIZE, chunk_count: this.NUM_CHUNKS }))
    //this.uploadFile(chunk, this.part);
    this.socket.emit("chunk", chunk_text)
    this.start = this.end;
    this.end = this.start + this.BYTES_PER_CHUNK;
    this.part++;
    this.counter++;
  }

  uploadFile(blobFile, part) {
    const file = this.inputFile.files[0];
    const fd = new FormData();
    fd.append("file", blobFile);
    fd.append("chunk_num", this.NUM_CHUNKS);
    this.xhr = new XMLHttpRequest();
    this.xhr.upload.addEventListener("progress", this.uploadProgress, false);

    this.xhr.open(
      "POST",
      "uploadhandler.php" +
      "?" +
      "filen=" +
      file.name +
      "&num=" +
      part +
      "&counter=" +
      this.counter,
    );

    this.xhr.addEventListener("load", this.uploadComplete, false);
    this.xhr.addEventListener("error", this.uploadFailed, false);
    this.xhr.addEventListener("abort", this.uploadCanceled, false);

    this.xhr.onload = function (e) {
      //alert("loaded!");
    };

    this.xhr.setRequestHeader("Cache-Control", "no-cache");
    this.xhr.send(fd);
    return;
  }

  uploadProgress(evt) {
    if (evt.lengthComputable) {
      const percentComplete = Math.round((evt.loaded * 100) / evt.total);
      document.getElementById("progressNumber").innerHTML =
        percentComplete.toString() + "%";
      document.getElementById("progressBar").style.backgroundColor = "teal";
    } else {
      document.getElementById("progressNumber").innerHTML = "unable to compute";
    }
  }

  uploadComplete(evt) {
    if (this.start < this.SIZE) {
      const chunk = blob.slice(this.start, this.end);

      this.uploadFile(chunk, this.part);

      this.start = this.end;
      this.end = this.start + this.BYTES_PER_CHUNK;
      this.part = this.part + 1;
    }
    document.getElementById("msgStatus").innerHTML = evt.target.responseText;
  }

  uploadFailed(evt) {
    alert("There was an error attempting to upload the file.");
  }

  uploadCanceled(evt) {
    this.xhr.abort();
    this.xhr = null;
    //alert("The upload has been canceled by the user or the browser dropped the connection.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const reference = document.getElementById("form1");
  new Uploader(reference);
});
