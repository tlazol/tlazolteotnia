---
title: "LangChain + TypeScript で chatGPT が知らないことも答えてもらう（ソースコード付き）"
date: "2023-04-07"
description: "LangChain と TypeScript を使い、ChatGPT が知らない最新情報を検索や Web 取得で補わせる実装メモ。"
tags: ["LangChain", "TypeScript", "chatGPT"]
draft: false
---
chatGPT と対話をしていると「私の知識が2021年までしかないことをお断りしておきます。」と、よく言われます。それをどうにかできるのが [LangChain](https://github.com/hwchase17/langchainjs) です。

LangChain は簡単に言えば LLM に追加の知識を与える手段です。この LangChain を使って遊んでみます。

題材は「[モビリティリゾートもてぎ](https://www.mr-motegi.jp/)の住所は?」にします。この前泊まってとても良かったので記憶に新しいです。めちゃくちゃオススメです。「ツインリンクもてぎ」から名前が変わったのが 2022 年のはずなので chatGPT は知らないはずです。ちなみに住所は `〒321-3597 栃木県芳賀郡茂木町桧山120-1` です。

# まずは普通に GPT-4 に聞いてみる

```
Q. モビリティリゾートもてぎの住所は?

A. 私の知識が2021年までしかないことをお断りしておきます。その時点では、モビリティリゾートもてぎは茨城県北茨城郡東海村大字奥中山田字下大貫１に位置していました。ただし、現在の住所が変更されている可能性もあるので、公式ウェブサイトや最新の情報を確認してください。
```

全然違いますね。そもそも栃木県です。知らないことは知らないって言いましょう。

# 次に LangChain で普通に聞いてみる

まずは今回のプロジェクトの package.json の抜粋です。良ければお使いください。

```json
{
  "dependencies": {
    "@pinecone-database/pinecone": "^0.0.12",
    "dotenv": "^16.0.3",
    "langchain": "^0.0.39",
    "puppeteer": "^19.8.3",
    "serpapi": "^1.1.1"
  },
  "devDependencies": {
    "@tsconfig/recommended": "^1.0.2",
    "@types/js-yaml": "^4",
    "@types/node": "^18.15.5",
    "@typescript-eslint/eslint-plugin": "^5.51.0",
    "@typescript-eslint/parser": "^5.51.0",
    "eslint": "^8.33.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-config-prettier": "^8.6.0",
    "eslint-plugin-import": "^2.27.5",
    "eslint-plugin-prettier": "^4.2.1",
    "prettier": "^2.8.3",
    "tsx": "^3.12.3",
    "typescript": "^4.9.5"
  }
}
```

下記が普通に聞くコードです。LangChain を使うだけで普通に OpenAI の API 使うよりシンプルになるので、いいですね。

```js
import * as dotenv from "dotenv"
import { OpenAI } from "langchain"

dotenv.config()

const model = new OpenAI()

const input = 'モビリティリゾートもてぎの住所は?'

const res = await model.call(input)

console.log(input)
console.log(res)
```
```
モビリティリゾートもてぎの住所は?

愛知県三河湾市もてぎ町三島2番地です。
```

同様に嘘を吐いてきましたね。では LangChain を使用して追加の知識を与えてみましょう。

# SerpAPI を使って Google 検索をさせる

LangChain には Agents という機能があります。ざっくり言えば chatGPT が使えるツールです。それらのツールを使って追加の知識を得られます。

- [Tools](https://js.langchain.com/docs/modules/agents/tools/)

そのツールの中に SerpAPI というものがあります。 SerpAPI は Google の検索結果をスクレイピングしてくれるサービスです。スクレイピングとはデータを収集して加工する事をいいます。つまりは chatGPT が Google 検索をしてくれるようになります。

```js
import * as dotenv from "dotenv"
import { OpenAI } from "langchain/llms"
import { SerpAPI } from "langchain/tools"
import { initializeAgentExecutor } from "langchain/agents"

dotenv.config()

const model = new OpenAI()
const tools = [new SerpAPI()]

const executor = await initializeAgentExecutor(tools, model, 'zero-shot-react-description')

const input = 'モビリティリゾートもてぎの住所は?'
const result = await executor.call({ input })

console.log(input)
console.log(result)
```
```
モビリティリゾートもてぎの住所は?

{
  output: '〒321-3597 栃木県芳賀郡茂木町桧山120-1',
  intermediateSteps: [
    {
      action: [Object],
      observation: 'モビリティリゾートもてぎのアクセスのご案内です。車・バイク、電車、バスなどさまざまなアクセス方法を掲載し ... 住所. 〒321-3597 栃木県芳賀郡茂木町桧山120-1 ...'
    }
  ]
}
```

はい、無事に正解してくれました。ちゃんとググってくれたようでなによりです。

# データベースで知識を拡張する

LangChain には Indexes という機能もあります。簡単に言えば独自のデータベースを持てるようになり、そこにある知識を使うことができます。

Puppeteer を使用してデータを Web からスクレイピングしてくれる機能もあるので、今回はそれを使ってみます。

- [Webpages, with Puppeteer](https://js.langchain.com/docs/modules/indexes/document_loaders/examples/web_loaders/web_puppeteer)

データベースは色々選べるみたいなのですが、今回はベクターデータベースの [pinecone](https://www.pinecone.io/) というものを使ってみました。ベクターデータベースについてはまだ理解しきれていません。

```
# GPT-4

ベクターデータベースとは、情報を特別な形式で保存するデータベースのことです。
この特別な形式は「ベクター」と呼ばれ、数字のリストで表現されます。
ベクターデータベースは、ベクターを使って情報を効率的に検索したり、
似たような情報を見つけ出すのに役立ちます。

例えば、おもちゃの箱があるとしましょう。
その箱の中に、たくさんのおもちゃが入っています。
ベクターデータベースは、おもちゃの特徴を数字のリストで表現することができます。
例えば、おもちゃの大きさや色、形状などです。
このリストを使って、おもちゃを効率的に分類したり、
似たおもちゃを見つけ出すことができます。

このように、ベクターデータベースは情報を数字のリスト（ベクター）で表現し、
効率的な検索や分類、類似性の判断などを行うことができるデータベースなのです。
```

サンキュー GPT-4

## pinecone にデータを格納する

```js
import * as dotenv from "dotenv"
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from 'langchain/embeddings'
// eslint-disable-next-line import/no-extraneous-dependencies
import { PineconeClient } from '@pinecone-database/pinecone'
import { PineconeStore } from 'langchain/vectorstores'
import { PuppeteerWebBaseLoader } from 'langchain/document_loaders'

dotenv.config()

const loader = new PuppeteerWebBaseLoader('https://www.mr-motegi.jp/access_m/', {
  launchOptions: {
    headless: true
  },
  gotoOptions: {
    waitUntil: 'domcontentloaded'
  },
  async evaluate(page) {
    const result = await page.evaluate(() => document.querySelector('.lig-content')?.innerText)
    return result
  }
})

const docs = await loader.load()

const textSplitter = new RecursiveCharacterTextSplitter({
  separators: ['\n'],
  chunkSize: 800,
  chunkOverlap: 200
})

const documents = await textSplitter.splitDocuments(docs)
console.log(documents)

const client = new PineconeClient()
await client.init({
  apiKey: process.env.PINECONE_API_KEY as string,
  environment: process.env.PINECONE_ENVIRONMENT as string
})
console.log('pinecone client end', client)

const pineconeIndex = client.Index(process.env.PINECONE_INDEX as string)
console.log('pineconeIndex end', pineconeIndex)

console.log('PineconeStore start')
await PineconeStore.fromDocuments(
  documents,
  new OpenAIEmbeddings(),
  {
    pineconeIndex
  }
)
console.log('PineconeStore end')
```

上記ソースコードで、モビリティリゾートもてぎの[アクセスのページ](https://www.mr-motegi.jp/access_m/)から住所情報をスクレイピングしてきた結果をゴニョゴニョして pinecone のベクターデータベースに格納しています。

正直ソースコードは理解していますが、なぜこの処理をしているのかは理解できていません。コピペで頑張っています。

GPT-4 に解説してもらった結果は下記です。

```
# GPT-4

このソースコードの処理は以下のようになります。

必要なモジュールをインポートする。
環境変数をロードする。
PuppeteerWebBaseLoaderを使って指定されたURLからコンテンツを取得する。
  ブラウザはヘッドレスモードで起動される。
  DOMが読み込まれるまで待つ。
  ページから.lig-content要素のinnerTextを取得する。
取得したコンテンツをテキスト分割器を使って分割する。
  改行で分割する。
  チャンクサイズは800、オーバーラップサイズは200。
分割されたドキュメントをコンソールに表示する。
PineconeClientを初期化し、APIキーと環境を設定する。
Pineconeのインデックスを取得する。
PineconeStoreを使ってドキュメントからベクトルストアを作成する。
  OpenAIEmbeddingsを使ってドキュメントをベクトル化する。
  Pineconeのインデックスを指定する。
```

何はさておきこれで pinecone に住所情報が格納されたはずです。

## pincone に格納されたデータを使用して返答する

```js
import * as dotenv from "dotenv"
import { OpenAI } from 'langchain/llms'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from 'langchain/embeddings'
// eslint-disable-next-line import/no-extraneous-dependencies
import { PineconeClient } from '@pinecone-database/pinecone'
import { PineconeStore } from 'langchain/vectorstores'
import { VectorDBQAChain } from 'langchain/chains'

dotenv.config()

export const run = async () => {
  const client = new PineconeClient()
  await client.init({
    apiKey: process.env.PINECONE_API_KEY as string,
    environment: process.env.PINECONE_ENVIRONMENT as string,
  })

  const pineconeIndex = client.Index(process.env.PINECONE_INDEX as string)

  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    { pineconeIndex }
  )

  const model = new OpenAI()
  const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
    k: 1,
    returnSourceDocuments: true,
  })

  const input = 'モビリティリゾートもてぎの住所は?'
  const response = await chain.call({
    query: input,
  })

  console.log(input)
  console.log(response)
}

run()
```
```
モビリティリゾートもてぎの住所は?
{
  text: ' 〒321-3597 栃木県芳賀郡茂木町桧山120-1',
  sourceDocuments: [
    Document {
      pageContent: 'Access\n' +
        '\n' +
        'Location\n' +
        '\n' +
        '住所\n' +
        '\n' +
        '〒321-3597\n' +
        '栃木県芳賀郡茂木町桧山120-1\n' +
        '\n' +
        '連絡先\n' +
        '\n' +
        'TEL：0285-64-0001（代表）\n' +
        '\n' +
        'GoogleMAPで見る\n' +
        '\n' +
        'ご注意\n' +
        '\n' +
        'ご来場時は目的地に「モビリティリゾートもてぎ南ゲートまたは北ゲート」を設定ください。\n' +
        '※「モビリティリゾートもてぎ」で登録いただくと、モビリティリゾートもてぎ敷地下を通る県道291号線付近に誘導される場合がございます。（県道291号線からはご入場いただけません）\n' +
        '\n' +
        'レース ⋅ イベントなどの混雑時について\n' +
        '\n' +
        'レース ⋅ イベント開催日は交通機関の混雑が予想されます。\n' +
        '▼混雑が予想されるレース ⋅ イベント\n' +
        '\n' +
        'レース\n' +
        '\n' +
        'MotoGP™、SUPER GT、スーパーフォーミュラ、Honda Racing THANKS DAY\n' +
        '\n' +
        'イベント\n' +
        '\n' +
        'ＧＷ、花火の祭典 夏、お盆期間\n' +
        '\n' +
        '各レース・イベントの開催日は年間カレンダーをご確認ください。\n' +
        '\n' +
        '混雑時の迂回路についてはこちら（PDF:880KB）\n' +
        'お車 ⋅ バイクでご来場の方\n' +
        '東京方面から\n' +
        '神奈川方面から\n' +
        '千葉方面から\n' +
        '埼玉方面から\n' +
        '茨城方面から\n' +
        '群馬方面から\n' +
        '福島方面から\n' +
        '\n' +
        '駐車場については料金 ⋅ チケット、園内マップページをご確認ください。\n' +
        '\n' +
        '電車でご来場の方\n' +
        '東京方面から\n' +
        '仙台方面から\n' +
        'バスでご来場の方\n' +
        'JR宇都宮駅 ⋅ 茂木駅から\n' +
        'JR水戸駅から\n' +
        'Recommendation\n' +
        '\n' +
        'Pick Up',
      metadata: [Object]
    }
  ]
}
```

こちらも無事に正解していますね。

# おわりに

chatGPT は普通に使うだけでは情報が古かったり、凡才だったりしますが、この LangChain で一気に専門性を高めることができるので、めちゃくちゃワクワクします。今後はしばらく LangChain で遊んでみようと思いました。
