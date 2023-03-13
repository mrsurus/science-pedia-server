const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config()
const bodyParser = require('body-parser')
const {Configuration, OpenAIApi} = require('openai')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors())
app.use(express.json())
app.use(bodyParser.json())

const config = new Configuration({
    apiKey: process.env.CHAT_API_KEY,
})

const openai = new OpenAIApi(config)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nzh9xhl.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try {
        const topicCollecton = client.db('sciencePedia').collection('topics')
        const commentsCollecton = client.db('sciencePedia').collection('comments')
        const usersCollection = client.db("sciencePedia").collection("users")


        //chatGPT get api
        app.post('/chat', async(req,res)=>{
            const {prompt} = req.body
            const completion = await openai.createCompletion({
                model: "text-davinci-003",
                max_tokens: 512,
                temperature: 0,
                prompt: prompt
            })
            res.send(completion.data.choices[0].text)
        })

        app.get('/topic', async(req, res)=>{
            const query ={}
            const result = await topicCollecton.find(query).toArray()
            res.send(result)
        })

        app.get('/topic/:id', async(req, res)=> {
            const id = req.params.id 
            const query = {_id: new ObjectId(id)}
            const result = await topicCollecton.findOne(query)
            res.send(result)
        })

        app.post('/comment', async(req,res)=>{
            const comment = req.body
            const result = await commentsCollecton.insertOne(comment)
            res.send(result)
        })

        app.get('/comment/:name', async(req, res)=>{
            const name = req.params.name
            const query ={topicName: name}
            const result = await commentsCollecton.find(query).toArray()
            res.send(result)
        })
        app.post('/users', async(req,res)=> {
            const data = req.body
            const result = await usersCollection.insertOne(data)
            res.send(result)
        })
    }
    finally{

    }
}
run().catch(console.log)

app.get('/', (req, res) => {
    res.send('Science pedia server is running')
})

app.listen(port, (req, res) => {
    console.log('server is running on port', port)
})
