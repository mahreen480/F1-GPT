import OpenAI from "openai"
import { DataAPIClient } from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
// import { load } from "langchain/load";

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"

import "dotenv/config"

// type SimilarityMetric = "dot_product" | "cosine" | "euclidean"

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
} = process.env;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

const f1Data = [
    'https://en.wikipedia.org/wiki/Formula_One',
    'https://www.skysports.com/f1/news/12433/13117256/lewis-hamilton-says-move-to-ferrari-was-the-right-time',
    'https://www.formula1.com/en/latest/all.html',
    'https://www.forbes.com/sites/brettknight/2023/11/29/formula-1s-highest-paid-drivers-2023/',
    'https://www.autosport.com/f1/news/history-of-female-f1-drivers-including-grand-prix/10547185/',
    'https://en.wikipedia.org/wiki/2023_Formula_One_World_Championship',
    'https://en.wikipedia.org/wiki/2022_Formula_One_World_Championship',
    'https://en.wikipedia.org/wiki/List_of_Formula_One_World_Drivers%27_Champions',
    'https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship',
    'https://www.formula1.com/en/results.html/2024/races.html',
    'https://www.formula1.com/en/racing/2024.html'
]

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_ENDPOINT!, { keyspace: ASTRA_DB_NAMESPACE })


const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})

// const createCollection = async (SimilarityMetric: SimilarityMetric = "dot_product") => {
//     const res = await db.createCollection(ASTRA_DB_COLLECTION!, {
//         vector: {
//             dimension: 1536,
//             metric: SimilarityMetric
//         }
//     })
//     console.log(res)
// }

const loadSampleData = async () => {
    const collection = db.collection(ASTRA_DB_COLLECTION!)
    for await (const url of f1Data) {
        const content = await scrapePage(url)
        const chunks = await splitter.splitText(content)
        for await (const chunk of chunks) {
            const embedding = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk,
                encoding_format: "float"
            })

            const vector = embedding.data[0].embedding

            const res = await collection.insertOne({
                $vector: vector,
                text: chunk

            })
            console.log(res)
        }
    }
}
const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: true,
        },
        gotoOptions: {
            waitUntil: 'domcontentloaded',
        },
        evaluate: async (page) => {
            const result = await page.evaluate(() => document.body.innerHTML)
            return result
        }

    })
    return (await loader.load())[0].pageContent
}

// createCollection().then(()=>loadSampleData())
loadSampleData();