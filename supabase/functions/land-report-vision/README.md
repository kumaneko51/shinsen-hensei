# 土地戦報の画像読取り API

`land-report-vision` は、ログイン済みの一門所有者だけが使える画像読取りAPIです。画像は解析のためにOpenAIへ送られますが、この関数自体は画像・解析結果をSupabaseへ保存しません。返却された候補を確認してから、既存の取込ツールで保存してください。

## Supabase Secrets

Supabase Dashboard の **Edge Functions → Secrets** に次の2項目を登録します。APIキーをリポジトリや画面の設定欄へ保存しないでください。

| 名前 | 値 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI APIキー |
| `LAND_REPORT_VISION_MODEL` | 使用する画像対応モデル名 |

その後、Supabase CLI または Dashboard から `land-report-vision` をデプロイします。

## 呼び出し

`POST /functions/v1/land-report-vision`

認証済みのアクセストークンを `Authorization: Bearer <access token>` で渡し、JSON本文へ一門IDと5MB以下のPNG/JPEGを指定します。

```json
{
  "familyId": "一門UUID",
  "image": {
    "mimeType": "image/png",
    "base64": "画像ファイルをBase64化した文字列"
  }
}
```

返り値には `candidate` と `warnings` が含まれます。`warnings` が空でないときは、兵数・部隊名・勝敗を人が確認してから登録してください。
