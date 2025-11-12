// 20200220_glsl Genetic Face_v0.frag
// Title: Genetic Face
// Reference: https://www.shadertoy.com/view/XsGXWW

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

//Test if a point is in a triangle
bool pointInTriangle(vec2 triPoint1, vec2 triPoint2, vec2 triPoint3, vec2 testPoint)
{
    float denominator = ((triPoint2.y - triPoint3.y)*(triPoint1.x - triPoint3.x) + (triPoint3.x - triPoint2.x)*(triPoint1.y - triPoint3.y));
    float a = ((triPoint2.y - triPoint3.y)*(testPoint.x - triPoint3.x) + (triPoint3.x - triPoint2.x)*(testPoint.y - triPoint3.y)) / denominator;
    float b = ((triPoint3.y - triPoint1.y)*(testPoint.x - triPoint3.x) + (triPoint1.x - triPoint3.x)*(testPoint.y - triPoint3.y)) / denominator;
    float c = 1.0 - a - b;
 
    return 0.0 <= a && a <= 1.0 && 0.0 <= b && b <= 1.0 && 0.0 <= c && c <= 1.0;
}

void main()
{
    vec2 imageUV  = fragCoord.xy / iResolution.xy;
    vec2 testUV = imageUV;

#ifdef EVERY_PIXEL_SAME_COLOR
    testUV = vec2(1.0, 1.0);   
#endif

    vec2 triPoint1 = vec2(Random_Final(testUV, iTime), Random_Final(testUV, iTime * 2.0));
    vec2 triPoint2 = vec2(Random_Final(testUV, iTime * 3.0), Random_Final(testUV, iTime * 4.0));
    vec2 triPoint3 = vec2(Random_Final(testUV, iTime * 5.0), Random_Final(testUV, iTime * 6.0));

    vec4 testColor = vec4(Random_Final(testUV, iTime * 10.0),
                          Random_Final(testUV, iTime * 11.0),
                          Random_Final(testUV, iTime * 12.0),
                          1.0);

#ifdef SOURCE_COLORS
    vec2 colorUV = vec2(Random_Final(testUV, iTime * 10.0),
                        Random_Final(testUV, iTime * 11.0));

    testColor = texture( u_tex1, colorUV );
#endif
    
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
        float prevDiff = abs(length(trueColor - prevColor));
        float testDiff = abs(length(trueColor - testColor));
        float score = prevDiff-testDiff;
        if(u_time < 20.0 && score < 0.0) gl_FragColor = testColor;          //backwards evolution
        else if(u_time >= 20.0 && score > 0.0) gl_FragColor = testColor;    //forward evolution
        
    }

}


//==================Main Pass
#else

void main()
{
    vec2 uv=fragCoord/iResolution.xy;
    gl_FragColor = texture2D( u_buffer0, uv );
}

#endif

