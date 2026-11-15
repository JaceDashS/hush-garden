/**
 * The prompt players copy from the settings into an AI chat to make a character image map. The AI first asks
 * what character they want, then draws the sheet with code to the exact format the server accepts.
 */
import { SHEET, SHEET_ROWS } from "./imageCharacters";
import type { Language } from "./text";

const { width, height, frame, columns, foot } = SHEET;
const rows = SHEET.height / SHEET.frame;
const n = {
  walk: SHEET_ROWS.walk.frames,
  lift: SHEET_ROWS.lift.frames,
  carry: SHEET_ROWS.carry.frames,
  create: SHEET_ROWS.create.frames,
  discard: SHEET_ROWS.discard.frames,
};

const PROMPTS: Record<Language, string> = {
  en: `You are helping me make my own character for Hush Garden, a cozy quarter-view garden game. Follow these steps in order.

Step 1. Before drawing anything, ask me what character I want: what it is (an animal, an object, a creature...), its colours, its mood, and how it makes a speaker appear and how it gets rid of one (for example: pulls it out of the ground, kicks it away). Ask in one short message and wait for my answer.

Step 2. When I answer, draw the character as an image map (sprite sheet) by writing and running code, for example Python with Pillow. Do not use image generation: the grid must be exact.

Image map format. It must match exactly or the upload is refused:
- One PNG, ${width} x ${height} px, RGBA with a transparent background.
- ${columns} columns x ${rows} rows of ${frame} x ${frame} px frames. Row 1 is the top, column 1 the left.
- The character faces right in every frame.
- Its feet touch the point (${foot.x}, ${foot.y}) of every frame, the bottom centre. Keep its size the same in every frame and leave about 8 px free at the frame edges.
- Rows, using frames from the left. Leave the other cells empty.
  1. Standing: 1 frame.
  2. Walking: ${n.walk} frames (left foot forward, passing, right foot forward, passing).
  3. Lifting a speaker: ${n.lift} frames (crouch, reach down, rise, and end with both hands raised above the head).
  4. Walking while holding a speaker overhead: ${n.carry} frames, hands up the whole time.
  5. Making a speaker: ${n.create} frames of its own way of making one, ending with both hands raised above the head.
  6. Discarding a speaker: ${n.discard} frames, starting with both hands raised above the head, of its own way of getting rid of it.
- Do not draw the speaker. The game draws it on the raised hands, so keep about 40 px above the head free in rows 3 to 6.
- Style: soft rounded shapes, a dark brown outline (#4a4038) about 4 px thick, flat pastel colours. The game shows it at half size, so keep shapes simple and bold.

Step 3. Check the file with code: ${width} x ${height}, RGBA, transparent corners, and every used frame has pixels on the foot line. Show me a preview of the whole sheet and an enlarged walking animation (GIF), then give me the PNG file to download.

Step 4. Offer to change anything I want. When I am happy, remind me: in Hush Garden, open Settings, Custom characters, type a name and upload the PNG. An administrator reviews it before it can be used.

Talk with me in English.`,

  ko: `너는 아늑한 쿼터뷰 정원 게임 Hush Garden에서 쓸 나만의 캐릭터를 만드는 걸 도와줘. 아래 순서를 지켜 줘.

1단계. 그리기 전에 먼저 어떤 캐릭터를 원하는지 물어봐. 무엇인지(동물, 물건, 상상 속 생물 등), 색, 분위기, 그리고 스피커를 어떻게 만들어 내고 어떻게 버리는지(예: 땅에서 뽑아낸다, 발로 차 버린다). 짧은 메시지 하나로 묻고 내 대답을 기다려.

2단계. 내가 대답하면 코드를 작성하고 실행해서(예: Python과 Pillow) 캐릭터를 이미지 맵(스프라이트 시트)으로 그려. 이미지 생성 기능은 쓰지 마. 격자가 정확해야 해.

이미지 맵 규격. 정확히 맞지 않으면 업로드가 거절돼:
- PNG 한 장, ${width} x ${height} px, 투명 배경의 RGBA.
- ${frame} x ${frame} px 프레임이 가로 ${columns}칸, 세로 ${rows}줄. 1줄은 맨 위, 1칸은 맨 왼쪽.
- 모든 프레임에서 캐릭터는 오른쪽을 봐.
- 모든 프레임에서 발이 프레임의 (${foot.x}, ${foot.y}) 지점, 즉 아래 가운데에 닿아. 모든 프레임에서 크기를 같게 하고 프레임 가장자리는 8 px 정도 비워 둬.
- 줄 구성. 왼쪽부터 프레임을 쓰고 나머지 칸은 비워 둬.
  1. 서 있기: 1프레임.
  2. 걷기: ${n.walk}프레임 (왼발 앞, 지나가는 자세, 오른발 앞, 지나가는 자세).
  3. 스피커 들기: ${n.lift}프레임 (웅크리고, 아래로 손을 뻗고, 일어나서, 마지막엔 두 손을 머리 위로 든 자세).
  4. 스피커를 머리 위로 든 채 걷기: ${n.carry}프레임, 내내 두 손을 든 채.
  5. 스피커 만들기: 캐릭터만의 방법으로 ${n.create}프레임, 마지막엔 두 손을 머리 위로 든 자세.
  6. 스피커 버리기: 두 손을 머리 위로 든 자세에서 시작해 캐릭터만의 방법으로 ${n.discard}프레임.
- 스피커는 그리지 마. 게임이 들어 올린 손 위에 그려 주니까 3~6줄에서는 머리 위 40 px 정도를 비워 둬.
- 스타일: 부드럽고 둥근 모양, 4 px 정도의 짙은 갈색 외곽선(#4a4038), 단색 파스텔 색. 게임에서는 절반 크기로 보이니까 모양을 단순하고 굵게.

3단계. 코드로 파일을 확인해: ${width} x ${height}, RGBA, 투명한 모서리, 쓰는 프레임마다 발 높이에 픽셀이 있는지. 전체 시트 미리보기와 크게 확대한 걷기 애니메이션(GIF)을 보여 주고, PNG 파일을 내려받을 수 있게 줘.

4단계. 고치고 싶은 게 있는지 물어봐. 내가 만족하면 알려 줘: Hush Garden에서 설정의 '직접 만든 캐릭터'를 열고 이름을 적은 뒤 PNG를 올리면 돼. 관리자가 확인한 뒤에 쓸 수 있어.

나와는 한국어로 대화해 줘.`,

  ja: `くつろげるクォータービューの庭ゲーム Hush Garden で使う、自分だけのキャラクター作りを手伝ってください。次の順番で進めてください。

ステップ1. 描く前に、どんなキャラクターがほしいかを聞いてください。何なのか(動物、物、空想の生き物など)、色、雰囲気、そしてスピーカーをどうやって出して、どうやって捨てるのか(例: 地面から引き抜く、蹴飛ばす)。短いメッセージひとつで聞いて、私の答えを待ってください。

ステップ2. 私が答えたら、コードを書いて実行し(例: Python と Pillow)、キャラクターをイメージマップ(スプライトシート)として描いてください。画像生成は使わないでください。グリッドが正確でなければなりません。

イメージマップの仕様。正確に合っていないとアップロードが拒否されます:
- PNG 1枚、${width} x ${height} px、背景が透明な RGBA。
- ${frame} x ${frame} px のフレームが横 ${columns} 列、縦 ${rows} 行。1行目が一番上、1列目が一番左。
- どのフレームでもキャラクターは右を向きます。
- どのフレームでも足がフレームの (${foot.x}, ${foot.y})、つまり下の中央に触れます。大きさはすべてのフレームで同じにし、フレームの端は 8 px ほど空けてください。
- 行の構成。左からフレームを使い、残りのマスは空のままにします。
  1. 立ち: 1フレーム。
  2. 歩き: ${n.walk}フレーム(左足を前、すれ違う姿勢、右足を前、すれ違う姿勢)。
  3. スピーカーを持ち上げる: ${n.lift}フレーム(しゃがみ、下に手を伸ばし、立ち上がり、最後は両手を頭の上に上げた姿勢)。
  4. スピーカーを頭の上に持って歩く: ${n.carry}フレーム、ずっと両手を上げたまま。
  5. スピーカーを作る: そのキャラクターらしいやり方で ${n.create}フレーム、最後は両手を頭の上に上げた姿勢。
  6. スピーカーを捨てる: 両手を頭の上に上げた姿勢から始めて、そのキャラクターらしいやり方で ${n.discard}フレーム。
- スピーカーは描かないでください。ゲームが上げた手の上に描くので、3〜6行目では頭の上を 40 px ほど空けてください。
- スタイル: やわらかく丸い形、太さ 4 px ほどの濃い茶色の輪郭線(#4a4038)、ベタ塗りのパステルカラー。ゲームでは半分の大きさで表示されるので、形はシンプルで太めに。

ステップ3. コードでファイルを確認してください: ${width} x ${height}、RGBA、四隅が透明、使うフレームごとに足の高さにピクセルがあること。シート全体のプレビューと、拡大した歩きアニメーション(GIF)を見せてから、PNG ファイルをダウンロードできるようにしてください。

ステップ4. 直したいところがあるか聞いてください。私が満足したら教えてください: Hush Garden で 設定の「オリジナルキャラクター」を開き、名前を入力して PNG をアップロードします。管理者が確認したあとで使えるようになります。

私とは日本語で話してください。`,

  zh: `请帮我为温馨的四分之三视角花园游戏 Hush Garden 制作一个属于我自己的角色。请按以下顺序进行。

第1步. 在画之前,先问我想要什么样的角色:它是什么(动物、物品、幻想生物等)、颜色、气质,以及它如何变出一个音箱、又如何丢掉音箱(例如:从地里拔出来、一脚踢飞)。用一条简短的消息提问,然后等我回答。

第2步. 我回答后,请编写并运行代码(例如 Python 和 Pillow),把角色画成图像图(精灵图)。不要使用图像生成功能,网格必须精确。

图像图规格。必须完全符合,否则上传会被拒绝:
- 一张 PNG,${width} x ${height} 像素,透明背景的 RGBA。
- ${frame} x ${frame} 像素的帧,横向 ${columns} 列,纵向 ${rows} 行。第1行在最上面,第1列在最左边。
- 每一帧中角色都面向右边。
- 每一帧中脚都接触帧内的 (${foot.x}, ${foot.y}) 点,即底部中央。每一帧中的大小保持一致,帧的边缘留出约 8 像素的空白。
- 各行内容,从左边开始使用帧,其余格子留空。
  1. 站立:1帧。
  2. 行走:${n.walk}帧(左脚在前、交错姿势、右脚在前、交错姿势)。
  3. 举起音箱:${n.lift}帧(蹲下、向下伸手、站起,最后双手举过头顶)。
  4. 把音箱举在头顶行走:${n.carry}帧,双手一直举着。
  5. 制作音箱:用这个角色独有的方式,${n.create}帧,最后双手举过头顶。
  6. 丢掉音箱:从双手举过头顶的姿势开始,用这个角色独有的方式,${n.discard}帧。
- 不要画音箱。游戏会把它画在举起的双手上,所以第3到第6行头顶上方要留出约 40 像素的空白。
- 风格:柔和圆润的形状,约 4 像素粗的深棕色轮廓线(#4a4038),平涂的粉彩色。游戏中以一半大小显示,所以形状要简单、线条要粗。

第3步. 用代码检查文件:${width} x ${height}、RGBA、四角透明,每个使用的帧在脚的高度上都有像素。先给我看整张图的预览和放大的行走动画(GIF),再把 PNG 文件给我下载。

第4步. 问我有没有想修改的地方。我满意后请提醒我:在 Hush Garden 中打开 设置 中的“自制角色”,输入名字并上传 PNG。管理员审核后才能使用。

请用中文和我交流。`,
};

/** The prompt in the app's language. */
export function characterPrompt(language: Language): string {
  return PROMPTS[language] ?? PROMPTS.en;
}
