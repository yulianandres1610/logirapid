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

    const prompt = `Generate a HIGH QUALITY, SHARP, vibrant product advertisement image for social media.

SIZE: ${dimensions}

DESIGN:
- Eye-catching modern e-commerce advertisement
- Bold orange (#f97316) background at the top ~20% with a large white pentagon/arrow shape pointing up, filling most of the image
- Light orange (#fdba74) decorative triangles on the sides
- The product photo must be LARGE, SHARP, HIGH-RESOLUTION in the center of the white area
- Product name: "${productName}" in bold, large dark text below the product
- Price: "${priceCUP ? priceCUP.toLocaleString() + ' CUP' : ''}" in EXTRA LARGE bold orange text
- Secondary price: "$${priceUSD || '0.00'} USD" in smaller gray text
- Orange footer bar with: phone "+5352584700" left, "Servisumic - Ferretería y Mercado" center, "catalogo.servisumic.com" right, all in white

QUALITY REQUIREMENTS:
- ULTRA SHARP text - every letter must be perfectly crisp and readable
- HIGH RESOLUTION product image - maintain all original detail
- Vivid, saturated colors - make the orange POP
- Professional studio-quality lighting on the product
- Clean white (#FFFFFF) background in the center area
- The image must look like it was made by a professional graphic designer
- READY TO POST on ${isFB ? 'Facebook' : 'Instagram'} - no further editing needed`

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
