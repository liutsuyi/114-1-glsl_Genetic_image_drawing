// 20200220_glsl Genetic Face_v0.frag
// 標題：Genetic Face（遺傳繪製）
// 參考： https://www.shadertoy.com/view/XsGXWW
// 更新： tsuyi


//#version 300 es
//#extension GL_OES_standard_derivatives : enable

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define iTime u_time
#define iResolution u_resolution
#define iMouse u_mouse
#define fragCoord gl_FragCoord.xy
uniform sampler2D u_tex0;		//data/CMH_oil_sad.png
uniform sampler2D u_tex1;       //data/CMH_oil_joy.png
uniform sampler2D u_buffer0;	//FBO from previous iterated frame
uniform float u_aperture; // 0..1, 控制光圈大小（0: 小光圈，景深淺；1: 大光圈，景深強）
uniform float u_hybridMix; // 0..1, 白天/夜景混合比例（0 = 完全白天 u_tex0, 1 = 完全夜景 u_tex1）

// 這個 shader 分為兩個 pass：
//  - PASS A (當定義 BUFFER_0 時)：在 buffer 上逐次生成隨機「圓形筆觸」（multi-scale circle brush），
//    判斷像素是否落在筆觸範圍內，計算該筆觸色塊與目標圖像色差，根據時間軸決定 forward/backward 演化，
//    並以 alpha 混合（半透明）將顏色與前一幀混合，達到漸進式繪製與演化的效果。
//  - Main Pass (沒有定義 BUFFER_0)：直接把 buffer 的內容輸出到畫面（顯示累積結果）。
//
// 主要概念：
//  - 使用 Random_Final() 根據測試 UV 與時間產生可復現的隨機數，用來決定筆觸圓心、顏色及尺度選擇。
//  - 以多個 radius（多尺度）組合成筆觸，對每個像素計算到圓心的距離並生成局部 alpha（brushAlpha），
//    以達到圓心不透明、邊緣漸淡的筆觸效果。
//  - 若像素屬於筆觸範圍，計算目前畫面（prevColor）與目標 trueColor、以及候選筆觸色（testColor）的距離差，
//    這個差值會決定是否接受該筆觸，採取半透明混合方式將其合成到 prevColor 上。
//  - 透過 u_time 分段控制：前半段（例如 t < 20）做 backwards evolution，後半段做 forward evolution。



//==================PASS A
#if defined( BUFFER_0 )

//#define SOURCE_COLORS
#define EVERY_PIXEL_SAME_COLOR
#define TRIANGLES

// 隨機函式來源（Martin），範例與參考： https://www.shadertoy.com/view/XlfGDS
float Random_Final(vec2 uv, float seed)
{
    float fixedSeed = abs(seed) + 1.0;
    float x = dot(uv, vec2(12.9898,78.233) * fixedSeed);
    return fract(sin(x) * 43758.5453);
}

// Random_Final 說明：
//  - 輸入：uv（位置或測試向量）與 seed（通常使用時間來產生不同序列）。
//  - 輸出：0..1 之間的偽隨機值，會根據 uv 與 seed 固定產生相同結果（可復現）。
//  - 用途：用來決定筆觸圓心、顏色、以及隨機尺度或其它隨機參數。

// 判斷一個點是否位於三角形內（重心座標法）
bool pointInTriangle(vec2 triPoint1, vec2 triPoint2, vec2 triPoint3, vec2 testPoint)
{
    float denominator = ((triPoint2.y - triPoint3.y)*(triPoint1.x - triPoint3.x) + (triPoint3.x - triPoint2.x)*(triPoint1.y - triPoint3.y));
    float a = ((triPoint2.y - triPoint3.y)*(testPoint.x - triPoint3.x) + (triPoint3.x - triPoint2.x)*(testPoint.y - triPoint3.y)) / denominator;
    float b = ((triPoint3.y - triPoint1.y)*(testPoint.x - triPoint3.x) + (triPoint1.x - triPoint3.x)*(testPoint.y - triPoint3.y)) / denominator;
    float c = 1.0 - a - b;
 
    return 0.0 <= a && a <= 1.0 && 0.0 <= b && b <= 1.0 && 0.0 <= c && c <= 1.0;
}

    // pointInTriangle 說明（目前未使用）：
    //  - 使用重心座標（barycentric coordinates）來判斷 testPoint 是否落在三角形內。
    //  - 此函式為原始三角形筆觸版本的輔助函式，現行實作改為多尺度圓形筆觸，故保留但未使用。
    //  - 若 a、b、c 都位於 0..1 範圍內，則 testPoint 在三角形內。

void main()
{
    vec2 imageUV  = fragCoord.xy / iResolution.xy;
    vec2 testUV = imageUV;

    // 每個像素的處理流程（摘要）：
    // 1. 以 imageUV 作為測試座標，或在宏 EVERY_PIXEL_SAME_COLOR 下固定 testUV
    // 2. 以 Random_Final(testUV, iTime * k) 產生筆觸圓心、顏色及可能的尺度參數
    // 3. 計算像素到圓心的距離，並以多尺度 radii 生成局部 alpha（brushAlpha）；若 brushAlpha>0 則屬於筆觸範圍
    // 4. 若屬於筆觸範圍，計算 score 決定是否接受該筆觸；接受時以 alpha 混合到 prevColor（mix(prevColor, testColor, testColor.a)）
    //    這樣可以達到半透明、多尺度筆觸逐步累積的效果，而不是直接覆蓋畫面。

#ifdef EVERY_PIXEL_SAME_COLOR
    testUV = vec2(1.0, 1.0);   
#endif

    // 改為使用多尺度圓形筆觸：產生圓心 center，並以多個 radius（尺度）做測試
    vec2 center = vec2(Random_Final(testUV, iTime), Random_Final(testUV, iTime * 2.0));
    // 基本 radii: 多尺度半徑（以 UV 空間為單位）。稍後會依據焦點(focus)放大或縮小
    vec3 radii = vec3(0.005, 0.02, 0.06);

    // ===== 景深控制 (Depth-of-field simulation) =====
    // 使用 high-pass (原圖 - blur) 作為焦點指標：高值代表細節多、接近焦點（in-focus）
    // 在景深內 (focus 高) 我們希望筆觸較小且邊緣銳利；景深外 (focus 低) 筆觸較大且邊緣模糊。
    // 先做一個簡單的 3x3 box/gaussian blur 當作低通，接著以原圖 - 低通 得到 highpass。
    float px = 1.0 / iResolution.x;
    float py = 1.0 / iResolution.y;
    vec3 blur = vec3(0.0);
    // 3x3 Gaussian-like weights (對每個 sample 使用 hybrid day/night mix)
    blur += mix(texture2D(u_tex0, imageUV + vec2(-px, -py)).rgb, texture2D(u_tex1, imageUV + vec2(-px, -py)).rgb, u_hybridMix) * 1.0;
    blur += mix(texture2D(u_tex0, imageUV + vec2( 0.0, -py)).rgb, texture2D(u_tex1, imageUV + vec2( 0.0, -py)).rgb, u_hybridMix) * 2.0;
    blur += mix(texture2D(u_tex0, imageUV + vec2( px, -py)).rgb, texture2D(u_tex1, imageUV + vec2( px, -py)).rgb, u_hybridMix) * 1.0;
    blur += mix(texture2D(u_tex0, imageUV + vec2(-px,  0.0)).rgb, texture2D(u_tex1, imageUV + vec2(-px,  0.0)).rgb, u_hybridMix) * 2.0;
    blur += mix(texture2D(u_tex0, imageUV + vec2( 0.0,  0.0)).rgb, texture2D(u_tex1, imageUV + vec2( 0.0,  0.0)).rgb, u_hybridMix) * 4.0;
    blur += mix(texture2D(u_tex0, imageUV + vec2( px,  0.0)).rgb, texture2D(u_tex1, imageUV + vec2( px,  0.0)).rgb, u_hybridMix) * 2.0;
    blur += mix(texture2D(u_tex0, imageUV + vec2(-px,  py)).rgb, texture2D(u_tex1, imageUV + vec2(-px,  py)).rgb, u_hybridMix) * 1.0;
    blur += mix(texture2D(u_tex0, imageUV + vec2( 0.0,  py)).rgb, texture2D(u_tex1, imageUV + vec2( 0.0,  py)).rgb, u_hybridMix) * 2.0;
    blur += mix(texture2D(u_tex0, imageUV + vec2( px,  py)).rgb, texture2D(u_tex1, imageUV + vec2( px,  py)).rgb, u_hybridMix) * 1.0;
    blur /= 16.0;
    // high-pass magnitude (以 hybrid image 作為焦點判定的 proxy)
    vec3 hybridCenter = mix(texture2D(u_tex0, imageUV).rgb, texture2D(u_tex1, imageUV).rgb, u_hybridMix);
    float hp = length(hybridCenter - blur);
    // scale high-pass 到 0..1（調整倍數可微調敏感度）
    // aperture 影響敏感度：光圈大（u_aperture -> 1）時，對高頻更敏感，景深效果更明顯
    float hpMult = mix(12.0, 60.0, clamp(u_aperture, 0.0, 1.0));
    float focusRaw = clamp(hp * hpMult, 0.0, 1.0);
    // 非線性壓縮指數也隨 aperture 調整（大光圈 -> 更強的非線性對比）
    float focusPow = mix(1.0, 2.6, clamp(u_aperture, 0.0, 1.0));
    float focus = pow(focusRaw, focusPow);

    // 根據 focus 決定尺度放大倍率與邊緣模糊參數
    // focus = 1 -> in-focus -> smaller brushes, sharper edges
    // focus = 0 -> out-of-focus -> larger brushes, softer edges
    // 放大 radiiScale 與 edgeSoft 範圍，並讓 aperture 影響最大/最小值
    float outMax = mix(1.8, 5.0, clamp(u_aperture, 0.0, 1.0));
    float inMin  = mix(0.9, 0.25, clamp(u_aperture, 0.0, 1.0));
    float radiiScale = mix(outMax, inMin, focus);

    float outSoft = mix(0.25, 1.2, clamp(u_aperture, 0.0, 1.0));
    float inSoft  = mix(0.05, 0.001, clamp(u_aperture, 0.0, 1.0));
    float edgeSoft = mix(outSoft, inSoft, focus);

    // --- 時間退火 (annealing) : 讓筆觸從大到小、由模糊到銳利
    // timeT：整體退火進度 (0..1)，以及 tNorm 用於接受門檻退火
    float timeT = clamp(iTime / 1200.0, 0.0, 1.0);
    float tNorm = clamp(iTime / 600.0, 0.0, 1.0);

    // radii 與 edgeSoft 隨時間逐步變小，幫助後期細節收斂
    float sizeEndFactor = 0.45;
    float radiiScaleAnnealed = mix(radiiScale, radiiScale * sizeEndFactor, timeT);
    float edgeSoftAnnealed = mix(edgeSoft, max(0.001, edgeSoft * 0.18), timeT);
    vec3 radiiScaled = radii * radiiScaleAnnealed;

    // Stroke index：以時間為 proxy，每秒一筆（視環境可調）。前 200 筆遵循原始隨機 / SOURCE_COLORS 模式，
    // 之後的筆觸顏色會參考畫面周圍的顏色（從累積 buffer 取樣）並加入小幅變化。
    float strokeIndexF = floor(iTime);
    bool isEarly = strokeIndexF < 200.0;

    // --- 時間退火參數（alpha / perturb / mutation 基底）
    float alphaStart = 0.6;
    float alphaEnd = 0.12;
    float baseAlpha = mix(alphaStart, alphaEnd, timeT);

    float perturbStart = 0.22;
    float perturbEnd   = 0.04;
    float perturbAnneal = mix(perturbStart, perturbEnd, timeT);

    float mutationBaseStart = 0.12;
    float mutationBaseEnd   = 0.02;
    float mutationBase = mix(mutationBaseStart, mutationBaseEnd, timeT);

    vec4 testColor = vec4(0.0);
    if(isEarly){
        testColor = vec4(Random_Final(testUV, iTime * 10.0),
                         Random_Final(testUV, iTime * 11.0),
                         Random_Final(testUV, iTime * 12.0),
                         baseAlpha); // early: random color，但 alpha 會退火
    } else {
        // sample local average color from the accumulated buffer around the brush center
        float sx = 1.0 / iResolution.x;
        float sy = 1.0 / iResolution.y;
        vec3 avg = vec3(0.0);
        // 3x3 sample around center (use u_buffer0 which stores previous accumulations)
        for(int yy=-1; yy<=1; yy++){
            for(int xx=-1; xx<=1; xx++){
                vec2 off = vec2(float(xx)*sx, float(yy)*sy);
                avg += texture2D(u_buffer0, clamp(center + off, vec2(0.0), vec2(1.0))).rgb;
            }
        }
        avg /= 9.0;
        // add small random perturbation based on testUV/time so colors vary but remain close to local average
        vec3 noise = vec3(Random_Final(testUV, iTime * 10.0) - 0.5,
                          Random_Final(testUV, iTime * 11.0) - 0.5,
                          Random_Final(testUV, iTime * 12.0) - 0.5);
        float perturb = perturbAnneal; // 控制色彩偏移幅度（隨時間降低）
        vec3 candidate = clamp(avg + noise * perturb, 0.0, 1.0);
        testColor = vec4(candidate, baseAlpha);
    }

#ifdef SOURCE_COLORS
    // 若使用來源貼圖選色，僅在前 200 筆時套用（保留原始行為）；之後改為參考畫面周圍色彩
    if(isEarly){
        vec2 colorUV = vec2(Random_Final(testUV, iTime * 10.0),
                            Random_Final(testUV, iTime * 11.0));
        testColor = texture( u_tex1, colorUV );
    }
#endif
    // enforce semi-transparency even when使用來源色：改為使用退火後的 baseAlpha
    testColor.a = baseAlpha;
    
    vec4 trueColor = texture2D( u_tex0, imageUV );
    // hybridTarget 為白天 (u_tex0) 與夜景 (u_tex1) 混合後的判斷目標
    vec4 hybridTarget = mix(trueColor, texture2D(u_tex1, imageUV), u_hybridMix);
    vec4 prevColor = texture2D( u_buffer0, imageUV );


    gl_FragColor = prevColor;

    bool isInTriangle = true;

// 使用多尺度圓形（取代三角形判斷）
#ifdef TRIANGLES
    // 計算該像素到圓心的距離，並檢查是否落在任一尺度的圓內；同時計算局部 alpha（由距離決定）
    float d = distance(imageUV, center);
    // 使用 smoothstep 以 edgeSoft 控制邊緣漸變寬度：越大越模糊
    float a0 = 1.0 - smoothstep(radiiScaled.x * (1.0 - edgeSoftAnnealed), radiiScaled.x, d);
    float a1 = 1.0 - smoothstep(radiiScaled.y * (1.0 - edgeSoftAnnealed), radiiScaled.y, d);
    float a2 = 1.0 - smoothstep(radiiScaled.z * (1.0 - edgeSoftAnnealed), radiiScaled.z, d);
    float brushAlpha = max(max(a0, a1), a2);
    // 若 brushAlpha > 0 表示該像素屬於圓形筆觸範圍
    isInTriangle = (brushAlpha > 0.0);
    // 將 testColor 的 alpha 與 brushAlpha 乘起來，讓圓心處更不透明、邊緣漸淡，呈現自然的筆觸邊緣。
    testColor.a *= brushAlpha;
#endif

    // original
    /*if(isInTriangle && abs(length(trueColor - testColor)) < abs(length(trueColor - prevColor)))
    {  gl_FragColor = testColor;}*/

    // modified for forward and backward evolution
    if(isInTriangle)
    {
        // 決策說明：
        // - prevDiff：目前畫面（prevColor）與目標圖像（trueColor）的距離（誤差）。
        // - testDiff：候選筆觸顏色（testColor）與目標圖像的距離。
        // - score = prevDiff - testDiff：若 score > 0，代表 testColor 比 prevColor 更接近目標（應接受）；反之則不接受。
        // 時間分段：在不同時間區間（u_time）下，接受條件方向可能會不同（backwards/forwards 演化）。
            // 使用 squared error（L2^2）以增加對顏色差異的敏感度，並加入接受閾值 acceptEps（隨時間退火）
            // 使用 hybridTarget 做為接受判斷的標準（decision target）
            vec3 diffPrev = hybridTarget.rgb - prevColor.rgb;
            vec3 diffTest = hybridTarget.rgb - testColor.rgb;
            float prevDiff = dot(diffPrev, diffPrev);
            float testDiff = dot(diffTest, diffTest);
            float score = prevDiff - testDiff;

            // 接受閾值退火（初期較寬鬆，後期變嚴格）
            float epsStart = 0.006;
            float epsEnd   = 0.0008;
            float acceptEps = mix(epsStart, epsEnd, tNorm);

            // 突變接受率已在上方以 mutationBase 計算，並與 focus 結合
            float mutationProb = clamp(mutationBase + 0.12 * (1.0 - focus), 0.0, 1.0);
            float mutR = Random_Final(imageUV, iTime * 13.0);
            bool mutated = (mutR < mutationProb);

            // 接受條件：分段時間判斷與突變
            if(u_time < 20.0) {
                if(score < -acceptEps || mutated) gl_FragColor = mix(prevColor, testColor, testColor.a);
            } else {
                if(score > acceptEps || mutated) gl_FragColor = mix(prevColor, testColor, testColor.a);
            }
        
    }

}


//==================Main Pass
#else

void main()
{
    vec2 uv=fragCoord/iResolution.xy;
    // Main Pass：當沒有定義 BUFFER_0 時，直接把 buffer 的內容輸出到畫面（顯示累積結果）。
    gl_FragColor = texture2D( u_buffer0, uv );
}

#endif

