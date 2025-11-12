// 20200220_glsl Genetic Face_v0.frag
// Title: Genetic Face
// Reference: https://www.shadertoy.com/view/XsGXWW
//updated: tsuyi


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

// 以下為中文註解說明：
// 這個 shader 分為兩個 pass：
//  - PASS A (當定義 BUFFER_0 時)：在 buffer 上逐次生成隨機三角形，判斷該像素是否在三角形內，
//    計算該三角形色塊與目標圖像色差，根據時間軸決定 forward/backward 演化，並以 alpha 混合
//    （半透明）將顏色與前一幀混合，達到漸進式繪製與演化的效果。
//  - Main Pass (沒有定義 BUFFER_0)：直接把 buffer 的內容輸出到畫面。
//
// 主要概念：
//  - 使用 Random_Final() 根據測試 UV 與時間產生可復現的隨機數，用來決定三角形頂點與顏色。
//  - 使用 pointInTriangle() 判斷當前像素是否落在隨機三角形內。
//  - 若在三角形內，計算目前像素（prevColor）與目標 trueColor、以及 candidate testColor 的距離差，
//    這個差值會決定是否「接受」該三角形顏色，並以半透明混合到 prevColor 上。
//  - 透過 u_time 分段控制：前半段（例如 t < 20）做 backwards evolution，後半段做 forward evolution。



//==================PASS A
#if defined( BUFFER_0 )

//#define SOURCE_COLORS
#define EVERY_PIXEL_SAME_COLOR
#define TRIANGLES

//Randomness code from Martin, here: https://www.shadertoy.com/view/XlfGDS
float Random_Final(vec2 uv, float seed)
{
    float fixedSeed = abs(seed) + 1.0;
    float x = dot(uv, vec2(12.9898,78.233) * fixedSeed);
    return fract(sin(x) * 43758.5453);
}

// Random_Final 說明：
//  - 輸入：uv（位置或測試向量）與 seed（通常使用時間來產生不同序列）。
//  - 輸出：0..1 之間的偽隨機值，會根據 uv 與 seed 固定產生相同結果（可復現）。
//  - 用途：用來決定三角形頂點位置、顏色等隨機但可重現的參數。

//Test if a point is in a triangle
bool pointInTriangle(vec2 triPoint1, vec2 triPoint2, vec2 triPoint3, vec2 testPoint)
{
    float denominator = ((triPoint2.y - triPoint3.y)*(triPoint1.x - triPoint3.x) + (triPoint3.x - triPoint2.x)*(triPoint1.y - triPoint3.y));
    float a = ((triPoint2.y - triPoint3.y)*(testPoint.x - triPoint3.x) + (triPoint3.x - triPoint2.x)*(testPoint.y - triPoint3.y)) / denominator;
    float b = ((triPoint3.y - triPoint1.y)*(testPoint.x - triPoint3.x) + (triPoint1.x - triPoint3.x)*(testPoint.y - triPoint3.y)) / denominator;
    float c = 1.0 - a - b;
 
    return 0.0 <= a && a <= 1.0 && 0.0 <= b && b <= 1.0 && 0.0 <= c && c <= 1.0;
}

// pointInTriangle 說明：
//  - 使用 barycentric coordinates（重心座標）計算 testPoint 是否位於三角形內。
//  - 若 a,b,c 都在 0..1 範圍內，即代表點落在三角形內。

void main()
{
    vec2 imageUV  = fragCoord.xy / iResolution.xy;
    vec2 testUV = imageUV;

    // 每個像素的處理流程（摘要）：
    // 1. 以 imageUV 作為測試座標，或在宏 EVERY_PIXEL_SAME_COLOR 下固定 testUV
    // 2. 以 Random_Final(testUV, iTime * k) 產生三角形頂點與顏色參數
    // 3. 判斷該像素是否位於三角形內（isInTriangle），若是，計算 score 決定是否混入顏色
    // 4. 混合使用 alpha（testColor.a）: gl_FragColor = mix(prevColor, testColor, testColor.a)
    //    這樣可以達到半透明累積效果，而不是直接覆蓋畫面。

#ifdef EVERY_PIXEL_SAME_COLOR
    testUV = vec2(1.0, 1.0);   
#endif

    vec2 triPoint1 = vec2(Random_Final(testUV, iTime), Random_Final(testUV, iTime * 2.0));
    vec2 triPoint2 = vec2(Random_Final(testUV, iTime * 3.0), Random_Final(testUV, iTime * 4.0));
    vec2 triPoint3 = vec2(Random_Final(testUV, iTime * 5.0), Random_Final(testUV, iTime * 6.0));

    vec4 testColor = vec4(Random_Final(testUV, iTime * 10.0),
                          Random_Final(testUV, iTime * 11.0),
                          Random_Final(testUV, iTime * 12.0),
                          0.5); // make triangle color semi-transparent

#ifdef SOURCE_COLORS
    vec2 colorUV = vec2(Random_Final(testUV, iTime * 10.0),
                        Random_Final(testUV, iTime * 11.0));

    testColor = texture( u_tex1, colorUV );
#endif
    // enforce semi-transparency even when using source colors
    testColor.a = 0.5;
    
    vec4 trueColor = texture2D( u_tex0, imageUV );
    vec4 prevColor = texture2D( u_buffer0, imageUV );


    gl_FragColor = prevColor;

    bool isInTriangle = true;

#ifdef TRIANGLES
    isInTriangle = pointInTriangle(triPoint1, triPoint2, triPoint3, imageUV); 
#endif

    // original
    /*if(isInTriangle && abs(length(trueColor - testColor)) < abs(length(trueColor - prevColor)))
    {  gl_FragColor = testColor;}*/

    // modified for forward and backward evolution
    if(isInTriangle)
    {
        // 決策說明：
        // - prevDiff：目前畫面（prevColor）與目標圖像（trueColor）的距離（誤差）。
        // - testDiff：候選三角形顏色（testColor）與目標圖像的距離。
        // - score = prevDiff - testDiff：若 score > 0，代表 testColor 比 prevColor 更接近目標（應接受）；反之則不接受。
        // 時間分段：在不同時間區間（u_time）下，接受條件方向可能會不同（backwards/forwards 演化）。
        float prevDiff = abs(length(trueColor - prevColor));
        float testDiff = abs(length(trueColor - testColor));
        float score = prevDiff-testDiff;
    if(u_time < 20.0 && score < 0.0) gl_FragColor = mix(prevColor, testColor, testColor.a);          //backwards evolution (blend)
    else if(u_time >= 20.0 && score > 0.0) gl_FragColor = mix(prevColor, testColor, testColor.a);    //forward evolution (blend)
        
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

