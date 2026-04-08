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
    const dimensions = isFB ? '940x788 pixels (landscape)' : '1080x1350 pixels (portrait)'

    const prompt = `Create a product advertisement image. Follow this EXACT template design:

CANVAS: ${dimensions}

LAYOUT (top to bottom):
1. TOP SECTION (~20% height): Solid orange background (#f97316). A white pentagon/arrow shape starts here with its peak pointing up at the top center. Two lighter orange (#fdba74) decorative triangles on the left and right sides, partially behind the white shape.

2. CENTER SECTION (~65% height): The white pentagon shape widens as it goes down, filling most of the width. Inside this white area:
   - The product image centered and large (occupying ~50% of the white area)
   - Below the product: the product name "${productName}" in bold dark text
   - Below the name: "${priceCUP ? priceCUP.toLocaleString() + ' CUP' : ''}" in LARGE bold orange (#f97316) text
   - Below CUP price: "$${priceUSD || '0.00'} USD" in smaller gray text

3. FOOTER BAR (~8% height): Solid orange (#f97316) bar at the very bottom with:
   - Left: white phone icon circle + "+5352584700" in white text
   - Center: "Servisumic - Ferretería y Mercado" in white bold text
   - Right: white globe icon circle + "catalogo.servisumic.com" in white text

STYLE RULES:
- Clean, modern, minimalist e-commerce ad
- The product floats naturally in the white area, no frame or border around it
- Text must be sharp, crisp, and perfectly readable
- Orange color is EXACTLY #f97316
- White area background is pure white #FFFFFF
- Professional typography, centered alignment
- NO shadows, NO gradients on the white area
- The design must look identical every time, only the product/price changes`

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
