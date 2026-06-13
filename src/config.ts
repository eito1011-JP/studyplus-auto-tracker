// 計測対象の判定基準とブロック化の閾値。SPEC 決定 #3・#4 準拠。
// app 名は aw-watcher-window が報告する macOS 上のアプリ名（例: VS Code は "Code"）。

export interface TrackerConfig {
  /** app 名だけで対象にするアプリ（エディタ・ターミナル）。タイトルは問わない。 */
  alwaysCountApps: string[];
  /** app 名が一致 かつ タイトルが devTitlePatterns に合致したときだけ対象にするアプリ（ブラウザ）。 */
  titleGatedApps: string[];
  /** ブラウザのタイトルが「開発関連」とみなされるパターン（決定 #3）。 */
  devTitlePatterns: RegExp[];
  /** この隙間未満は同一ブロックに連結、以上で区切る（決定 #4）。 */
  idleGapMs: number;
  /** ブロック末尾からこの時間を超えて沈黙したら「確定」＝投稿対象。 */
  finalizeSilenceMs: number;
  /** 全ブロックを紐づける教材名（決定 #6）。起動時に code を解決しキャッシュ。 */
  materialName: string;
}

export const config: TrackerConfig = {
  alwaysCountApps: ["Code", "Cursor", "Ghostty"],
  titleGatedApps: ["Dia"],
  devTitlePatterns: [
    /github\.com/i,
    /pull request/i,
    /\bPR\b/,
    /localhost/i,
    /127\.0\.0\.1/,
    /zenn\.dev/i,
    /qiita\.com/i,
    /stackoverflow\.com/i,
    /developer\./i,
    /\bdocs?\b/i,
    /\.dev\b/i,
  ],
  idleGapMs: 15 * 60 * 1000,
  finalizeSilenceMs: 15 * 60 * 1000,
  materialName: "アプリ開発",
};
