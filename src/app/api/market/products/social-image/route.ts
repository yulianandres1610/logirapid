import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY
const IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation'

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
    const dimensions = isFB ? '940x788' : '1080x1350'

    // Build the prompt for Gemini to generate a social media post image
    const prompt = `Generate a professional social media product advertisement image for ${isFB ? 'Facebook' : 'Instagram'}.

EXACT SPECIFICATIONS:
- Dimensions: ${dimensions} pixels
- This is a ${isFB ? 'Facebook post (landscape)' : 'Instagram post (portrait)'}

DESIGN REQUIREMENTS:
- Modern, clean, professional e-commerce advertisement
- Orange theme (#f97316 as primary color) with white accents
- Geometric design with an orange background and a large white pentagon/arrow shape in the center
- The product should be prominently displayed in the center of the white area
- Product name: "${productName}"
- Price displayed large and bold: ${priceCUP ? `${priceCUP.toLocaleString()} CUP` : ''}${priceUSD ? ` ($${priceUSD} USD)` : ''}
- Store: "${storeName || 'Servisumic'}"
- Orange footer bar at bottom with:
  - Phone: ${phone || '+5352584700'} on the left
  - Store logo/name "${storeName || 'Servisumic - Ferretería y Mercado'}" in the center
  - URL: ${catalogUrl || 'catalogo.servisumic.com'} on the right
- Footer icons should be white circles with phone and globe symbols
- Light orange decorative triangles on the sides behind the white area
- NO mockup phone or device - just the product floating/centered
- Text should be crisp and readable
- The overall style should match a professional hardware store / ferretería advertisement

CRITICAL: The image must look like a ready-to-post social media advertisement. Professional quality, sharp text, clean layout.`

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GOOGLE_AI_API_KEY}`,
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
      console.error('[Social Image] API Error:', response.status, errorText)
      return NextResponse.json({ success: false, error: 'Error de Gemini API: ' + response.status }, { status: 500 })
    }

    const data = await response.json()

    // Extract image from response
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          console.log('[Social Image] Image generated successfully')
          return NextResponse.json({
            success: true,
            imageBase64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          })
        }
      }
    }

    // Check if blocked
    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      return NextResponse.json({ success: false, error: 'Imagen bloqueada por filtro de seguridad' }, { status: 400 })
    }

    console.log('[Social Image] No image in response:', JSON.stringify(data).substring(0, 500))
    return NextResponse.json({ success: false, error: 'Gemini no generó imagen' }, { status: 500 })

  } catch (error) {
    console.error('[Social Image] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al generar imagen'
    }, { status: 500 })
  }
}
