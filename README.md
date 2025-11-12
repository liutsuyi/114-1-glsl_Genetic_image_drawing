# GLSL 簡易模板

這是一個使用 [glslCanvas.js](https://github.com/patriciogonzalezvivo/glslCanvas) 的簡易 GLSL 片段著色器 (fragment shader) 模板，可以輕鬆地在瀏覽器中即時預覽著色器創作。

## 如何開始

專案已設定好開發環境，可以選擇以下任一方式啟動。

### 方法一：使用 GitHub Codespaces (推薦)

這是最簡單的方式，不需在本機安裝任何軟體。

1.  在 GitHub 儲存庫頁面上，點擊綠色的 `<> Code` 按鈕。
2.  選擇 "Codespaces" 分頁。
3.  點擊 "Create codespace on main"。
4.  等待 Codespace 建立完成。環境會自動設定好，`Live Server` 也會啟動。
5.  一個包含著色器預覽畫面的新瀏覽器分頁將會自動開啟。

### 方法二：使用開發容器 (本機)

此方法會在電腦上建立一個與 Codespaces 相同的開發環境。

1.  請先安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。
2.  在 VS Code 中安裝 [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) 擴充功能。
3.  在 VS Code 中開啟此專案資料夾。
4.  VS Code 右下角會跳出提示，詢問是否要 "Reopen in Container"。請點擊它。
5.  容器建置完成後，`Live Server` 將自動啟動，並在瀏覽器中開啟預覽頁面。

### 方法三：僅使用 Live Server (本機)

如果不想使用 Docker，也可以直接在本機執行。

1.  在 VS Code 中開啟此專案資料夾。
2.  確保已安裝 [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) 擴充功能。
3.  在 `index.html` 檔案上按一下右鍵，然後選擇 "Open with Live Server"。
4.  預設瀏覽器將會開啟並顯示著色器效果。

## 如何客製化

### 更換著色器檔案

修改 `index.html` 中 `<canvas>` 標籤的 `data-fragment-url` 屬性。

```html
// filepath: /Users/yuan/Documents/GitHub/chimin-hsieh/glsl-simple-template/index.html
// ...existing code...
<body>
  <canvas id="glslCanvas" data-fragment-url="shader.frag" ... ></canvas>
</body>
// ...existing code...
```

### 載入紋理（Texture）

有兩種方式：

#### 方法一：在 HTML 中定義

修改 index.html 中 `<canvas>` 標籤的 `data-textures` 屬性。可以提供一個或多個圖片路徑，並以逗號分隔。在著色器中，它們會被依序命名為 `u_texture0`, `u_texture1`, ...。

```html
// filepath: /Users/yuan/Documents/GitHub/chimin-hsieh/glsl-simple-template/index.html
// ...existing code...
<body>
  <canvas id="glslCanvas" ... data-textures="data/texture1.jpg,data/texture2.png"></canvas>
</body>
// ...existing code...
```

#### 方法二：在著色器檔案中定義

在 `.frag` 檔案中，使用 `uniform sampler2D` 宣告紋理，並在同一行使用註解 `//` 加上圖片的路徑。這種方式可以自訂 uniform 變數的名稱。

```glsl
// filepath: shader.frag
#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_myTexture; // data/texture.jpg
uniform vec2 u_resolution;

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    gl_FragColor = texture2D(u_myTexture, st);
}
```

## 部署到 GitHub Pages

此專案是一個純靜態網頁，可以輕鬆部署到 GitHub Pages。

### 設定 GitHub Pages

1. 前往專案的 GitHub 儲存庫頁面，點擊上方的 "Settings"。
2. 在左側選單中，選擇 "Pages"。
3. 在 "Build and deployment" 下，將 "Source" 設定為 "Deploy from a branch"。
4. 在 "Branch" 區塊，選擇 main 分支，資料夾選擇 /(root)，然後點擊 "Save"。
5. 等待幾分鐘讓 GitHub Actions 完成部署。完成後，頁面頂端會顯示網站的公開網址。

### 設定連結到主頁面

1. 點擊上方的 "Code" 回到專案主頁面 "Code" 。
2. 在右側的 "About" 區塊，點擊齒輪圖示進入設定。
3. 勾選 "Use your GitHub Pages website" ，然後點擊 "Save changes"。這樣儲存庫首頁就會顯示網站連結了。

## 更新部署

設定完成後，每當將新的變更推送到 main 分支時，GitHub Pages 都會自動重新部署網站。

1. 在本機或 Codespaces 中修改專案檔案。
2. 將變更 commit 並 push 到 GitHub 上的 main 分支。
3. GitHub Actions 將會自動觸發新的部署流程。
4. 等待幾分鐘後，網站就會更新為最新版本。