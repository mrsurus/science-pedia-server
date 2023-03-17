const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000;
const jwt  = require('jsonwebtoken')
require('dotenv').config()
const bodyParser = require('body-parser')
const {Configuration, OpenAIApi} = require('openai')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")('sk_test_51MBZbQGWLIA8ie2kAX6UPPxPszSKgZsQhoFNaI0wjVy4wDvjh2gMxiX09bl0U5diQo8PRm8bu2wKduAGwU79hlZw00Lk8phNcz');


app.use(cors())
app.use(express.json())
app.use(bodyParser.json())

const config = new Configuration({
    apiKey: process.env.CHAT_API_KEY,
})

const openai = new OpenAIApi(config)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nzh9xhl.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
    const authHeader = req.headers.authorization
    if(!authHeader){
        return res.status(401).send('unauthorized access')
    }
    const token = authHeader.split(' ')[1]

    jwt.verify(token, process.env.JWT_TOKEN, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'forbidden acess'})
        }
        req.decoded = decoded;
        next()
    })
}

async function run(){
    try {
        const topicCollecton = client.db('sciencePedia').collection('topics')
        const commentsCollecton = client.db('sciencePedia').collection('comments')
        const usersCollection = client.db("sciencePedia").collection("users")
        const premiumCollection = client.db("sciencePedia").collection("premium")
        const paymentsCollection = client.db("sciencePedia").collection("payment")
        const questionsCollection = client.db("sciencePedia").collection("question")
        const answersCollection = client.db("sciencePedia").collection("answer")


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

        // payment
        app.post('/create-payment-intent',async(req,res)=>{
            const booking= req.body
            const price = booking.price
            const amount = price * 100;
            console.log(price,amount);
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ],
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
            console.log(paymentIntent.client_secret);
        } )

        //payment info save

        app.post('/payments',async(req, res)=>{
            const payment = req.body
            const result = await paymentsCollection.insertOne(payment)
            const email = payment.email
            const filter = {email: email}
            const updateDoc = {
                $set: {
                    paid: true,
                    status: payment.status
                }
            }
            const updateResult = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        //JWT token generet
        app.get('/jwt', async(req,res)=>{
            const email = req.query.email;
            const query = {email: email}
            const user = await usersCollection.findOne(query)
            if(user){
                const token = jwt.sign({email}, process.env.JWT_TOKEN, {expiresIn: '365d'})
                return res.send({accesstoken: token})
                console.log(token);
            }
            res.status(403).send({accesstoken:''})
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
        //my comments
        app.get('/mycomment',verifyJWT, async(req,res)=> {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if(email !== decodedEmail){
                return res.status(403).send({message: 'forbidden acess'})
            }
            const query = {email: email}
            const result = await commentsCollecton.find(query).toArray()
            res.send(result)
        })
        app.delete('/mycomment/:id', async(req,res)=>{
            const id = req.params.id
            const query ={_id:new ObjectId(id)}
            const result = await commentsCollecton.deleteOne(query)
            res.send(result)
        })
        //primium card
        app.get('/premium',async(req,res)=>{
            const query = {}
            const result = await premiumCollection.find(query).toArray()
            res.send(result)
        })

        //post question
        app.post('/questions', async(req,res)=>{
            const data = req.body
            const result = await questionsCollection.insertOne(data)
            res.send(result)
        })
        //get questions
        app.get('/questions', async(req,res)=>{
            const query ={}
            const result = await questionsCollection.find(query).toArray()
            res.send(result)
        })
        //post answer
        app.post('/answers', async(req,res)=>{
            const data = req.body
            const result = await answersCollection.insertOne(data)
            res.send(result)
        })
        //delete answer
        app.delete('/answers/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await answersCollection.deleteOne(query)
            res.send(result)
        })
        //get answer
        app.get('/answers/:id', async(req,res)=>{
            const id=req.params.id
            const query ={qId:id}
            const result = await answersCollection.find(query).toArray()
            res.send(result)
        })
        //delete questions
        app.delete('/questions/:id', async(req,res)=>{
            const id = req.params.id
            const query ={_id:new ObjectId(id)}
            const ansquery = {qId:id}
            const result = await questionsCollection.deleteOne(query)
            const ansresult = await answersCollection.deleteMany(ansquery)
            res.send({result, ansresult})
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
