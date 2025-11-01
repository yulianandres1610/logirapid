// Unsplash API integration for intelligent product images

interface UnsplashPhoto {
  id: string
  urls: {
    regular: string
    small: string
    thumb: string
  }
  description: string | null
  alt_description: string | null
  likes: number
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[]
  total: number
  total_pages: number
}

class UnsplashAPI {
  private static readonly ACCESS_KEY = 'rIJ_Lyx2LBp8jedXd46CoXj1Vwouxc8HNNhgCzkHYy0'
  private static readonly BASE_URL = 'https://api.unsplash.com'

  private static getHeaders(): HeadersInit {
    return {
      'Authorization': `Client-ID ${UnsplashAPI.ACCESS_KEY}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Generate search terms based on product name and description
   */
  private static generateSearchQuery(name: string, description: string, category: string): string {
    // Primary search term from product name (most important)
    let terms: string[] = [name.toLowerCase()]

    // Specific fruit mappings for better accuracy
    const fruitMappings: Record<string, string[]> = {
      'piña': ['pineapple', 'ananas', 'tropical pineapple'],
      'papaya': ['papaya', 'papaya fruit', 'tropical papaya'],
      'mango': ['mango', 'ripe mango', 'tropical mango'],
      'plátano': ['banana', 'ripe banana', 'tropical banana'],
      'guayaba': ['guava', 'tropical guava', 'pink guava'],
      'naranja': ['orange', 'fresh orange', 'citrus fruit'],
      'limón': ['lemon', 'fresh lemon', 'citrus'],
      'fresa': ['strawberry', 'fresh strawberry', 'red strawberry'],
      'toronja': ['grapefruit', 'fresh grapefruit', 'citrus grapefruit'],
      'melón': ['melon', 'fresh melon', 'cantaloupe'],
      'sandía': ['watermelon', 'fresh watermelon', 'red watermelon'],
      'aguacate': ['avocado', 'ripe avocado', 'fresh avocado'],
      'cereza': ['cherry', 'fresh cherry', 'red cherry'],
      'uva': ['grape', 'fresh grape', 'purple grape'],
      'manzana': ['apple', 'fresh apple', 'red apple'],
      'pera': ['pear', 'fresh pear', 'green pear']
    }

    // Enhanced category-specific terms with more precision
    const categoryTerms: Record<string, string[]> = {
      'frutas': ['fresh fruit', 'tropical fruit', 'organic fruit', 'whole fruit'],
      'verduras': ['vegetables', 'fresh vegetables', 'organic vegetables', 'garden vegetables'],
      'carnes': ['meat', 'fresh meat', 'butcher', 'raw meat'],
      'lacteos': ['dairy', 'milk', 'cheese', 'yogurt', 'fresh dairy'],
      'panaderia': ['bread', 'bakery', 'fresh bread', 'homemade bread'],
      'bebidas': ['drinks', 'beverages', 'refreshments', 'liquid drinks'],
      'snacks': ['snacks', 'chips', 'cookies', 'packaged snacks'],
      'enlatados': ['canned food', 'preserved food', 'packaged food'],
      'limpieza': ['cleaning products', 'household supplies', 'cleaning supplies'],
      'herramientas': ['tools', 'hardware tools', 'construction tools', 'power tools'],
      'electronica': ['electronics', 'tech gadgets', 'digital devices', 'electronic devices'],
      'ferreteria': ['hardware', 'tools', 'construction materials', 'building supplies'],
      'fontanería': ['plumbing', 'pipes', 'plumbing supplies', 'water pipes'],
      'electricidad': ['electrical supplies', 'wiring', 'electrical tools', 'electrical components'],
      'construcción': ['construction', 'building materials', 'construction supplies'],
      'autopartes': ['car parts', 'automotive', 'engine parts', 'vehicle parts'],
      'restaurante': ['food', 'prepared food', 'restaurant dish', 'cooked food'],
      'pizza': ['pizza', 'italian food', 'cooked pizza', 'cheese pizza'],
      'hamburguesas': ['burger', 'hamburger', 'fast food', 'beef burger'],
      'comida rápida': ['fast food', 'quick meal', 'ready to eat', 'takeout food']
    }

    // Add specific fruit mappings if applicable
    const lowerName = name.toLowerCase()
    if (fruitMappings[lowerName]) {
      // Replace the primary term with more specific fruit terms
      terms = fruitMappings[lowerName]
    }

    // Add category terms but prioritize product name
    if (categoryTerms[category]) {
      terms.push(...categoryTerms[category])
    }

    // Extract key terms from description (least important)
    if (description) {
      const descWords = description.toLowerCase().split(' ').filter(word => word.length > 3)
      terms.push(...descWords.slice(0, 2)) // Reduced to 2 words for more precision
    }

    // Remove duplicates and join, prioritize first terms
    return [...new Set(terms)].slice(0, 5).join(', ') // Limit to 5 terms for better results
  }

  /**
   * Search for images on Unsplash based on product information
   */
  static async searchProductImage(
    name: string,
    description: string,
    category: string
  ): Promise<string> {
    try {
      const query = this.generateSearchQuery(name, description, category)

      // More specific search terms for better accuracy
      let enhancedQuery = query

      // Add specific modifiers based on category
      if (['frutas', 'verduras', 'carnes', 'lacteos', 'panaderia', 'bebidas'].includes(category)) {
        enhancedQuery = `${query}, fresh food, high quality, natural`
      } else if (['ferreteria', 'herramientas', 'construcción', 'electricidad', 'fontanería'].includes(category)) {
        enhancedQuery = `${query}, tools, hardware, professional, equipment`
      } else if (['electronica', 'autopartes'].includes(category)) {
        enhancedQuery = `${query}, technology, modern, high quality, device`
      } else {
        enhancedQuery = `${query}, product, high quality`
      }

      // For fruits, add extra specificity
      if (category === 'frutas') {
        enhancedQuery = `${enhancedQuery}, fruit, whole fruit, ripe fruit`
      }

      const response = await fetch(
        `${this.BASE_URL}/search/photos?query=${encodeURIComponent(enhancedQuery)}&per_page=5&orientation=squarish&content_filter=high&order_by=relevant`,
        {
          headers: this.getHeaders(),
          next: { revalidate: 3600 } // Cache for 1 hour
        }
      )

      if (!response.ok) {
        if (response.status === 403) {
          console.warn('Unsplash API limit reached, using fallback images')
        } else {
          throw new Error(`Unsplash API error: ${response.status}`)
        }
        return this.getFallbackImage(name, category)
      }

      const data: UnsplashSearchResponse = await response.json()

      if (data.results.length > 0) {
        // Select the best image from the results
        const bestPhoto = this.selectBestImage(data.results, name, category)

        // Download the image and trigger a download (required by Unsplash API)
        this.triggerDownload(bestPhoto.id)

        return bestPhoto.urls.regular
      } else {
        // Fallback to a more general search
        return this.getFallbackImage(name, category)
      }
    } catch (error) {
      console.error('Error fetching Unsplash image:', error)
      return this.getFallbackImage(name, category)
    }
  }

  /**
   * Trigger download for Unsplash API compliance
   */
  private static async triggerDownload(photoId: string): Promise<void> {
    try {
      await fetch(`${this.BASE_URL}/photos/${photoId}/download`, {
        headers: this.getHeaders(),
      })
    } catch (error) {
      console.warn('Failed to trigger download:', error)
    }
  }

  /**
   * Select the best image from multiple results
   */
  private static selectBestImage(photos: UnsplashPhoto[], productName: string, category: string): UnsplashPhoto {
    if (photos.length === 1) return photos[0]

    const productNameLower = productName.toLowerCase()

    // Score each photo based on relevance
    const scoredPhotos = photos.map(photo => {
      let score = 0

      // Check if description or alt_description contains the product name
      if (photo.description) {
        score += photo.description.toLowerCase().split(' ').filter(word =>
          word.includes(productNameLower) || productNameLower.includes(word)
        ).length * 3
      }

      if (photo.alt_description) {
        score += photo.alt_description.toLowerCase().split(' ').filter(word =>
          word.includes(productNameLower) || productNameLower.includes(word)
        ).length * 2
      }

      // For fruits, prioritize images that look like whole fruits
      if (category === 'frutas') {
        const fruitKeywords = ['fruit', 'whole', 'fresh', 'ripe', 'tropical']
        const descriptionText = `${photo.description || ''} ${photo.alt_description || ''}`.toLowerCase()
        score += fruitKeywords.filter(keyword => descriptionText.includes(keyword)).length * 2
      }

      // Prefer images with more likes (higher quality)
      if (photo.likes) {
        score += Math.min(photo.likes / 1000, 2) // Cap at 2 points for likes
      }

      return { photo, score }
    })

    // Sort by score and return the best one
    scoredPhotos.sort((a, b) => b.score - a.score)
    return scoredPhotos[0].photo
  }

  /**
   * Get fallback image based on product category
   */
  private static getFallbackImage(name: string, category: string): string {
    // Specific fallback images for tropical fruits and Cuban products - IMÁGENES VERIFICADAS CORRECTAS
    const specificFallbacks: Record<string, string> = {
      'piña': 'https://images.unsplash.com/photo-1550258987-190a2d41a7ba?w=800&h=800&fit=crop', // Piña real
      'papaya': 'https://images.unsplash.com/photo-1606674559565-97937a68318a?w=800&h=800&fit=crop', // Papaya real
      'mango': 'https://images.unsplash.com/photo-1553279768-865dbe71fe8e?w=800&h=800&fit=crop', // Mango real
      'plátano': 'https://images.unsplash.com/photo-1543316380-603a6185e4c3?w=800&h=800&fit=crop', // Plátano real
      'guayaba': 'https://images.unsplash.com/photo-1605492822491-385a3bc4f3c2?w=800&h=800&fit=crop', // Guayaba
      'naranja': 'https://images.unsplash.com/photo-1547148613-804033c27a4f?w=800&h=800&fit=crop', // Naranja real
      'limón': 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=800&h=800&fit=crop', // Limón real
      'fresa': 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&h=800&fit=crop', // Fresa real
      'toronja': 'https://images.unsplash.com/photo-1577234286642-fc512a5f8f11?w=800&h=800&fit=crop', // Toronja real
      'melón': 'https://images.unsplash.com/photo-1595405912542-5ae55e9e7497?w=800&h=800&fit=crop', // Melón real
      'sandía': 'https://images.unsplash.com/photo-1586643358252-8554b710b04c?w=800&h=800&fit=crop', // Sandía real
      'aguacate': 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=800&h=800&fit=crop', // Aguacate real
      'cereza': 'https://images.unsplash.com/photo-1528821128474-27f963b062bf?w=800&h=800&fit=crop', // Cereza real
      'uva': 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800&h=800&fit=crop', // Uva real
      'manzana': 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&h=800&fit=crop', // Manzana real
      'pera': 'https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?w=800&h=800&fit=crop', // Pera real
      'lechuga': 'https://images.unsplash.com/photo-1568904338033-9e40628c7e7e?w=800&h=800&fit=crop', // Lechuga real
      'pepino': 'https://images.unsplash.com/photo-1582870766864-31e613878b5a?w=800&h=800&fit=crop', // Pepino real
      'pimiento': 'https://images.unsplash.com/photo-1583996302125-149a70fa9234?w=800&h=800&fit=crop', // Pimiento real
      'berenjena': 'https://images.unsplash.com/photo-1590487841098-35d45ef6c635?w=800&h=800&fit=crop', // Berenjena real
      'calabaza': 'https://images.unsplash.com/photo-1583212292454-1ae672e30aa6?w=800&h=800&fit=crop', // Calabaza real
      // Productos con múltiples nombres posibles
      'mangos': 'https://images.unsplash.com/photo-1553279768-865dbe71fe8e?w=800&h=800&fit=crop',
      'plátanos': 'https://images.unsplash.com/photo-1543316380-603a6185e4c3?w=800&h=800&fit=crop',
      'piñas': 'https://images.unsplash.com/photo-1550258987-190a2d41a7ba?w=800&h=800&fit=crop',
      'papayas': 'https://images.unsplash.com/photo-1606674559565-97937a68318a?w=800&h=800&fit=crop',
      'guayabas': 'https://images.unsplash.com/photo-1605492822491-385a3bc4f3c2?w=800&h=800&fit=crop'
    }

    // Check if there's a specific fallback first
    const normalizedName = name.toLowerCase().trim()
    if (specificFallbacks[normalizedName]) {
      return specificFallbacks[normalizedName]
    }

    // Fallback images by category - IMÁGENES VERIFICADAS CORRECTAS
    const fallbackImages: Record<string, string[]> = {
      'frutas': [
        'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&h=800&fit=crop', // Frutas tropicales variadas
        'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=800&h=800&fit=crop', // Frutas frescas
        'https://images.unsplash.com/photo-1606674559565-97937a68318a?w=800&h=800&fit=crop', // Papaya
        'https://images.unsplash.com/photo-1553279768-865dbe71fe8e?w=800&h=800&fit=crop', // Mango
        'https://images.unsplash.com/photo-1543316380-603a6185e4c3?w=800&h=800&fit=crop', // Plátano
        'https://images.unsplash.com/photo-1547148613-804033c27a4f?w=800&h=800&fit=crop', // Naranja
        'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&h=800&fit=crop', // Fresas
        'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800&h=800&fit=crop'  // Uvas
      ],
      'verduras': [
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=800&fit=crop', // Verduras frescas
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&h=800&fit=crop', // Vegetales variados
        'https://images.unsplash.com/photo-1568904338033-9e40628c7e7e?w=800&h=800&fit=crop', // Lechuga
        'https://images.unsplash.com/photo-1582870766864-31e613878b5a?w=800&h=800&fit=crop', // Pepino
        'https://images.unsplash.com/photo-1583996302125-149a70fa9234?w=800&h=800&fit=crop', // Pimientos
        'https://images.unsplash.com/photo-1590487841098-35d45ef6c635?w=800&h=800&fit=crop'  // Berenjena
      ],
      'carnes': [
        'https://images.unsplash.com/photo-1529692236671-f1f6cf9683be?w=800&h=800&fit=crop', // Carne fresca
        'https://images.unsplash.com/photo-1546833999-b8f1a5ab5c6f?w=800&h=800&fit=crop', // Res
        'https://images.unsplash.com/photo-1603048297172-9bcf9054194a?w=800&h=800&fit=crop', // Pollo
        'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=800&fit=crop'  // Cerdo
      ],
      'lacteos': [
        'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=800&fit=crop', // Leche y productos lácteos
        'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&h=800&fit=crop', // Quesos
        'https://images.unsplash.com/photo-1445526286561-3ca62030bfcd?w=800&h=800&fit=crop'  // Yogurt
      ],
      'panaderia': [
        'https://images.unsplash.com/photo-1509440159597-0b5ee57d8baf?w=800&h=800&fit=crop', // Pan fresco
        'https://images.unsplash.com/photo-1558961360-f3b4751fb4df?w=800&h=800&fit=crop', // Productos de panadería
        'https://images.unsplash.com/photo-1586802546583-7bf3e9a5c8c3?w=800&h=800&fit=crop'  // Pasteles
      ],
      'bebidas': [
        'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&h=800&fit=crop', // Bebidas frescas
        'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=800&fit=crop', // Jugos
        'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800&h=800&fit=crop'  // Refrescos
      ],
      'default': [
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1478369402113-1fd53f17e8b4?w=800&h=800&fit=crop',
        'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=800&fit=crop'
      ]
    }

    const categoryImages = fallbackImages[category] || fallbackImages.default
    const index = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % categoryImages.length

    return categoryImages[index]
  }

  /**
   * Batch search for multiple products (with rate limiting)
   */
  static async searchMultipleProductImages(
    products: Array<{ name: string; description: string; category: string }>
  ): Promise<Array<{ index: number; imageUrl: string }>> {
    const results: Array<{ index: number; imageUrl: string }> = []

    // Process in batches to respect rate limits
    const batchSize = 5
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize)

      const batchPromises = batch.map(async (product, batchIndex) => {
        const imageUrl = await this.searchProductImage(
          product.name,
          product.description,
          product.category
        )
        return { index: i + batchIndex, imageUrl }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add delay between batches to respect rate limits
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }
}

export default UnsplashAPI