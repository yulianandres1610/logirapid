import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
// Use the same model that works for product image generation in gemini.ts
const IMAGE_MODEL = 'gemini-2.0-flash-exp'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * POST /api/market/products/social-image
 * Genera imagen profesional para redes sociales usando Gemini
 * Body: { productName, productImageUrl, priceCUP, priceUSD, platform, storeName, phone, catalogUrl }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value
    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret'
      jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    if (!GOOGLE_AI_API_KEY) {
      return NextResponse.json({ success: false, error: 'GOOGLE_AI_API_KEY no configurada' }, { status: 500 })
    }

    const body = await request.json()
    const { productName, productImageBase64, priceCUP, priceUSD, platform, storeName, phone, catalogUrl } = body

    if (!productName || !platform) {
      return NextResponse.json({ success: false, error: 'productName y platform requeridos' }, { status: 400 })
    }

    const isFB = platform === 'facebook'
    const dimensions = isFB ? '940x788 pixels (landscape)' : '1080x1350 pixels (portrait)'
    const cupPrice = priceCUP ? priceCUP.toLocaleString() : '0'
    const usdPrice = priceUSD || '0.00'

    const prompt = `Generate a professional social media product advertisement for a hardware store brand called "Servisumic".

IMAGE SIZE: ${dimensions}

BRAND IDENTITY:
- Brand name: "Servisumic - Ferretería y Mercado"
- Primary color: Vivid Orange (#EB5B0C / rgb(235,91,12))
- Secondary color: Dark brown (#3F3B39 / rgb(63,59,57))
- Style: Bold, modern, industrial-chic hardware store aesthetic
- Phone: +5352584700
- Website: catalogo.servisumic.com

LAYOUT:
- TOP: Orange (#EB5B0C) header area with geometric white pentagon shape pointing upward from center, lighter orange triangles on sides as decoration
- CENTER: Large pure white area inside the pentagon shape. Place the product photo here, LARGE and CENTERED, occupying at least 40-50% of the white space. The product must be the HERO of the image - sharp, well-lit, eye-catching
- BELOW PRODUCT: Product name "${productName}" in bold dark text (large, readable)
- PRICES (must be prominent and readable):
  * Main price: "${cupPrice} CUP" in EXTRA LARGE BOLD orange (#EB5B0C) text - this is the attention grabber
  * Secondary: "$${usdPrice} USD" in medium gray text below
- FOOTER: Solid orange (#EB5B0C) bar across the bottom with white text:
  * Left side: phone icon + "+5352584700"
  * Center: "Servisumic" logo text + "Ferretería y Mercado"
  * Right side: globe icon + "catalogo.servisumic.com"

CRITICAL REQUIREMENTS:
- The product image must be CRYSTAL CLEAR, HIGH RESOLUTION - preserve every detail from the reference photo
- All text must be PERFECTLY SHARP and READABLE - no blurry or distorted text
- The orange must be VIBRANT and SATURATED (#EB5B0C exactly)
- Both prices (CUP and USD) MUST appear clearly - these are essential for the customer
- Professional graphic design quality - ready to publish on ${isFB ? 'Facebook' : 'Instagram'}
- Make it ATTENTION-GRABBING - a customer scrolling social media should stop and look`

    const contents: any[] = [{ text: prompt }]

    // If we have the product image, include it for reference
    if (productImageBase64) {
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: productImageBase64.replace(/^data:image\/\w+;base64,/, '')
        }
      })
    }

    console.log('[Social Image] Generating with Gemini for:', productName, platform)

    // Try multiple models in order
    const MODELS = [IMAGE_MODEL, 'gemini-2.0-flash', 'gemini-1.5-flash']

    for (const model of MODELS) {
      try {
        console.log(`[Social Image] Trying model: ${model}`)
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_AI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: contents }],
              generationConfig: {
                responseModalities: ['IMAGE', 'TEXT']
              }
            })
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[Social Image] ${model} Error:`, response.status, errorText.substring(0, 300))
          continue // Try next model
        }

        const data = await response.json()

        // Check if blocked
        if (data.candidates?.[0]?.finishReason === 'SAFETY') {
          console.log(`[Social Image] ${model} blocked by safety filter`)
          continue
        }

        // Extract image from response
        if (data.candidates?.[0]?.content?.parts) {
          for (const part of data.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              console.log(`[Social Image] Success with model: ${model}`)
              return NextResponse.json({
                success: true,
                imageBase64: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'image/png'
              })
            }
          }
        }

        console.log(`[Social Image] ${model} no image in response`)
      } catch (modelErr) {
        console.error(`[Social Image] ${model} exception:`, modelErr instanceof Error ? modelErr.message : modelErr)
      }
    }

    return NextResponse.json({ success: false, error: 'No se pudo generar la imagen. Intente de nuevo.' }, { status: 500 })

  } catch (error) {
    console.error('[Social Image] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al generar imagen'
    }, { status: 500 })
  }
}
