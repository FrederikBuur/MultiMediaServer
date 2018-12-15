const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs')
const server = require('http').createServer(app);
const socketIo = require('socket.io');
const multer = require('multer')
    
var socketCount = 0;
var messages = [];
var port = process.env.PORT
if (port == null || port == "") {
    port = 8000
}

server.listen(port, () => {
    console.log(`Server running... on ${port}`);
});

const baseUrl = `https://frozen-stream-46849.herokuapp.com/`;
//const baseUrl = `http://192.168.1.13:8000/`; //local host

// set storage engine
const storage = multer.diskStorage({
    destination: './public/',
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
})

// init upload
const upload = multer({
    storage: storage,
    limits: {fileSize: 15000000} //15,000,000
})

// public folder
app.use(express.static('./public/'));

// get test
app.get('/', (req, res) => {        //req = request, res = response test 
    res.send("Hello world");
});

// POST upload image
app.post('/image/', upload.single('image'), (req, res) => {
    uploadFile('image', req, res);
})

// POST upload audio
app.post('/audio/', upload.single('audio'), (req, res) => {
    uploadFile('audio', req, res);
})

// POST upload video
app.post('/video/', upload.single('video'), (req, res) => {
    uploadFile('video', req, res);
})

// POST upload document
app.post('/document/', upload.single('document'), (req, res) => {
    uploadFile('document', req, res);
})

// GET latest messages
app.get('/latest-messages/', (req, res) => {
    res.send(JSON.stringify(messages))
})

// shared upload function
function uploadFile(type, req, res) {
    var tmp_path = req.file.path;
    var target_path = `public/${type}/${req.file.originalname}`; 
    var src = fs.createReadStream(tmp_path);
    var dest = fs.createWriteStream(target_path);
    src.pipe(dest);
    const url = `${baseUrl}${type}/${req.file.originalname}`;

    src.on('end', () => { 
        response = {
            url: url
        }; 
        var resp = JSON.stringify(response)

        res.send(resp);
    });
    src.on('error', (err) => { 
        console.log(`error uploading ${type}`); 
        res.status(400).end(`error uploading ${type}: ${err}`);
    });
    fs.unlink(tmp_path, (err) => {});
}

// add message to array
function appendMessage(msg) {
    if(messages.length >= 10) {
        messages.pop
    }
    messages.push(msg)
}

const io = socketIo(server);
io.on('connection', (socket) => {
    socketCount++;

    // when new user joins chat
    socket.on("user_joined", (data) => {
        console.log(`${JSON.stringify(data)} joined, ${socketCount} in chat`);
        socket.broadcast.emit("user_joined", data);
    })

    socket.on("user_typing", (data) => {
        console.log(`User is typing: ${JSON.stringify(data)}`);
        socket.broadcast.emit("user_typing", data);
    })

    socket.on("user_stop_typing", (data) => {
        console.log(`User stop typing: ${JSON.stringify(data)}`);
        socket.broadcast.emit("user_stop_typing", data);
    })

    // recieve new messages
    socket.on("new_message", (data) => {
        const object = JSON.parse(data);
        object.date = Date.now() // setting date when message is recieved on server
        console.log("New Message: " + JSON.stringify(object));

        // broadcast message to everyone els
        socket.broadcast.emit("new_message", object);
        appendMessage(object)
    });

    socket.on("disconnect", (socket => {
        socketCount--;
        console.log("Someone disconnected. %s in chat", socketCount);
    }));

});