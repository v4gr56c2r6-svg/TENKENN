TENKEN PRO Ver.4 クラウド共有版（初期版）

【重要】この版はFirebase Authentication + Firestoreで文字データを共有します。写真の共有・写真添付保存は未実装です。写真欄は移行方針に合わせて一時的に外しています。既存写真は端末内に残ります。

GitHubで置き換えるファイル：index.html / app.js / style.css / service-worker.js
新規追加：firestore.rules
manifest.jsonは既存のままでOK。

Firebase準備：
1. Authenticationでメール/パスワードを有効化。
2. Firestore > ルールに firestore.rules の内容を貼り付けて公開。
3. Authentication > Users からスタッフを追加。
4. Firestore users コレクションに、各UIDと同じドキュメントIDで displayName(string), role(string: admin または staff), active(boolean: true) を登録。
5. 既存管理者のUID文書も role=admin, active=true, displayName=店長 になっていることを確認。

初回移行：
管理者でログインし、「旧バックアップを移行」から旧JSONを選択。点検履歴・異常報告の文章・点検項目をクラウドに追加します。写真は移行しません。
※Firestore Write Batchには500書き込み上限があります。大量データの場合は一度に移行できない可能性があります。

公開前テスト：
テストスタッフを追加してusers/{UID}を作成し、別ブラウザ/端末でログイン。点検更新と異常報告がリアルタイム共有されることを確認。
users文書はクライアントから書き換え不可。管理者のアカウント追加・権限変更はFirebase Consoleで行います。
