
import { createServer, METHODS } from 'http'
import { Server } from "socket.io"
import cors from "cors"
import fs from "fs"
import { v7 as uuidv7 } from "uuid"
import { Socket } from 'node:dgram'


// const corsOptions = {
//     origin: "*",
//     methods: "*",
//     optionSuccessStatus: 200
// }
const httpServer = createServer((req, res) => {

    const path = req.url
    const method = req.method

    res.writeHead(200, { 'Content-Type': 'application/json' })

    // if (true) {}

})

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: "*" 
  }
})
const UPLOADS_FOLDER = "uploads"
const CHUNK_SIZE = 10 * 1024 * 8

io.on('connection', async (socket) => {

    socket.on("reconnect", (user_id) => {
        socket.data.user_id = user_id
        socket.emit("ok")
    })

    socket.on("generate_id", () => {
        socket.data.user_id = uuidv7()
        socket.emit("user_id", socket.data.user_id)
        const folderName = `${UPLOADS_FOLDER}/${socket.data.user_id}`

        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName)
        }
    })

    socket.on("metadata", (data_string) => {
        if (!socket.data.user_id) {
            socket.emit("no_user")
            return
        }
        const data = JSON.parse(data_string)

        const {filename, size, chunk_count} = data
        socket.data.filename = filename
        socket.data.size = size
        socket.data.chunk_count = chunk_count
        
        const filepath = `./${UPLOADS_FOLDER}/${socket.data.user_id}/${filename}`
        fs.closeSync(fs.openSync(filepath, 'a+'))

        const total = fs.statSync(filepath)
        const current_chunk = Math.floor(size / CHUNK_SIZE)
        const full_chunks = current_chunk * CHUNK_SIZE

        if ((full_chunks - current_chunk) > 0) {
            fs.truncateSync(filepath, full_chunks - current_chunk)
        }

        socket.emit("ready_to_chunk", { current_chunk: current_chunk})
    })

    socket.on("chunk", (data) => {
        if (!socket.data.user_id) {
            socket.emit("no_user")
            return
        }

        if (data.length > CHUNK_SIZE) {
            socket.emit("error")
            return
        }

        const filepath = `./${UPLOADS_FOLDER}/${socket.data.user_id}/${socket.data.filename}`

        fs.writeFileSync(filepath, data, err => {
            console.err(err)
            socket.emit("error")
            return
        })

        socket.emit("chunk:ok", data.length)

        if (fs.statSync(filepath) === socket.data.size) {
            socket.emit("file:done")
        }
    })
})

httpServer.listen(8080, () => {
    console.log("running on 8080")
})
