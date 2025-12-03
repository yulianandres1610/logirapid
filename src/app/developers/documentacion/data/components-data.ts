// Components Documentation Data - Waypoints/Markers for Mobile Apps

export interface ComponentExample {
  id: string
  title: string
  description: string
  preview: string
  examples: {
    language: string
    label: string
    code: string
  }[]
}

export interface ComponentSection {
  id: string
  title: string
  description: string
  components: ComponentExample[]
}

// Colores de zonas predefinidos
export const zoneColors = [
  { name: 'Azul', hex: '#3B82F6' },
  { name: 'Rojo', hex: '#EF4444' },
  { name: 'Verde', hex: '#10B981' },
  { name: 'Naranja', hex: '#F97316' },
  { name: 'Morado', hex: '#8B5CF6' },
  { name: 'Rosa', hex: '#EC4899' },
  { name: 'Amarillo', hex: '#EAB308' },
  { name: 'Cyan', hex: '#06B6D4' },
]

// Componentes de marcadores para mapas
export const mapComponents: ComponentSection = {
  id: 'map-markers',
  title: 'Marcadores de Mapa',
  description: 'Componentes visuales para representar ubicaciones en el mapa de la aplicacion movil.',
  components: [
    {
      id: 'warehouse-marker',
      title: 'Marcador de Almacen',
      description: 'Marcador circular verde con icono de edificio para representar almacenes o puntos de inicio/fin de ruta.',
      preview: `
+------------------+
|                  |
|    +------+      |
|    |  🏢  |      |  <- Circulo verde 32px
|    +------+      |     con borde blanco
|                  |
+------------------+

Color: #10B981 (Verde)
Borde: 3px blanco
Tamano: 32x32px
Sombra: rgba(0,0,0,0.3)
`,
      examples: [
        {
          language: 'flutter',
          label: 'Flutter',
          code: `// Marcador de Almacen - Flutter/Dart
import 'package:flutter/material.dart';

class WarehouseMarker extends StatelessWidget {
  final String label;
  final bool isStart;

  const WarehouseMarker({
    Key? key,
    this.label = '',
    this.isStart = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: const Color(0xFF10B981), // Verde
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white,
          width: 3,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: const Center(
        child: Text(
          '🏢',
          style: TextStyle(fontSize: 16),
        ),
      ),
    );
  }
}

// Uso con Google Maps Flutter
Marker warehouseMarker = Marker(
  markerId: MarkerId('warehouse_start'),
  position: LatLng(warehouseLatitude, warehouseLongitude),
  icon: await BitmapDescriptor.fromAssetImage(
    ImageConfiguration(size: Size(32, 32)),
    'assets/markers/warehouse.png',
  ),
  infoWindow: InfoWindow(
    title: 'Almacen (Inicio)',
    snippet: warehouseAddress,
  ),
);`
        },
        {
          language: 'kotlin',
          label: 'Kotlin',
          code: `// Marcador de Almacen - Android/Kotlin
import android.content.Context
import android.graphics.*
import android.graphics.drawable.Drawable
import androidx.core.content.ContextCompat
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory

class WarehouseMarkerGenerator(private val context: Context) {

    companion object {
        private const val MARKER_SIZE = 32 // dp
        private const val BORDER_WIDTH = 3f // dp
        private const val WAREHOUSE_COLOR = 0xFF10B981.toInt() // Verde
    }

    fun createWarehouseMarker(): BitmapDescriptor {
        val size = (MARKER_SIZE * context.resources.displayMetrics.density).toInt()
        val borderWidth = BORDER_WIDTH * context.resources.displayMetrics.density

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Sombra
        val shadowPaint = Paint().apply {
            isAntiAlias = true
            color = Color.argb(76, 0, 0, 0) // 0.3 opacity
            maskFilter = BlurMaskFilter(8f, BlurMaskFilter.Blur.NORMAL)
        }
        canvas.drawCircle(
            size / 2f,
            size / 2f + 2f,
            size / 2f - borderWidth,
            shadowPaint
        )

        // Circulo verde principal
        val circlePaint = Paint().apply {
            isAntiAlias = true
            color = WAREHOUSE_COLOR
            style = Paint.Style.FILL
        }
        canvas.drawCircle(
            size / 2f,
            size / 2f,
            size / 2f - borderWidth,
            circlePaint
        )

        // Borde blanco
        val borderPaint = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = borderWidth
        }
        canvas.drawCircle(
            size / 2f,
            size / 2f,
            size / 2f - borderWidth / 2,
            borderPaint
        )

        // Emoji de edificio
        val textPaint = Paint().apply {
            isAntiAlias = true
            textSize = 16f * context.resources.displayMetrics.density
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(
            "🏢",
            size / 2f,
            size / 2f + textPaint.textSize / 3,
            textPaint
        )

        return BitmapDescriptorFactory.fromBitmap(bitmap)
    }
}

// Uso en el mapa
val warehouseGenerator = WarehouseMarkerGenerator(context)
val warehouseMarkerOptions = MarkerOptions()
    .position(LatLng(warehouseLatitude, warehouseLongitude))
    .icon(warehouseGenerator.createWarehouseMarker())
    .title("Almacen (Inicio)")
    .snippet(warehouseAddress)

googleMap.addMarker(warehouseMarkerOptions)`
        },
        {
          language: 'swift',
          label: 'Swift',
          code: `// Marcador de Almacen - iOS/Swift
import UIKit
import MapKit

class WarehouseMarkerView: MKAnnotationView {

    static let reuseIdentifier = "WarehouseMarker"

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setupMarker()
    }

    required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        setupMarker()
    }

    private func setupMarker() {
        frame = CGRect(x: 0, y: 0, width: 32, height: 32)

        // Crear la imagen del marcador
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32))
        image = renderer.image { context in
            let rect = CGRect(x: 0, y: 0, width: 32, height: 32)
            let circlePath = UIBezierPath(ovalIn: rect.insetBy(dx: 3, dy: 3))

            // Sombra
            context.cgContext.setShadow(
                offset: CGSize(width: 0, height: 2),
                blur: 8,
                color: UIColor.black.withAlphaComponent(0.3).cgColor
            )

            // Relleno verde
            UIColor(red: 0x10/255, green: 0xB9/255, blue: 0x81/255, alpha: 1).setFill()
            circlePath.fill()

            // Borde blanco
            UIColor.white.setStroke()
            circlePath.lineWidth = 3
            circlePath.stroke()

            // Emoji
            let emoji = "🏢" as NSString
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 16)
            ]
            let textSize = emoji.size(withAttributes: attributes)
            let textRect = CGRect(
                x: (32 - textSize.width) / 2,
                y: (32 - textSize.height) / 2,
                width: textSize.width,
                height: textSize.height
            )
            emoji.draw(in: textRect, withAttributes: attributes)
        }

        centerOffset = CGPoint(x: 0, y: -16)
        canShowCallout = true
    }
}

// Annotation personalizada
class WarehouseAnnotation: NSObject, MKAnnotation {
    let coordinate: CLLocationCoordinate2D
    let title: String?
    let subtitle: String?
    let isStart: Bool

    init(
        coordinate: CLLocationCoordinate2D,
        title: String,
        subtitle: String,
        isStart: Bool = true
    ) {
        self.coordinate = coordinate
        self.title = title
        self.subtitle = subtitle
        self.isStart = isStart
    }
}

// Uso en el mapa
let warehouseAnnotation = WarehouseAnnotation(
    coordinate: CLLocationCoordinate2D(
        latitude: warehouseLatitude,
        longitude: warehouseLongitude
    ),
    title: "Almacen (Inicio)",
    subtitle: warehouseAddress,
    isStart: true
)
mapView.addAnnotation(warehouseAnnotation)

// En el delegate del mapa
func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
    if let warehouseAnnotation = annotation as? WarehouseAnnotation {
        let view = mapView.dequeueReusableAnnotationView(
            withIdentifier: WarehouseMarkerView.reuseIdentifier
        ) ?? WarehouseMarkerView(
            annotation: warehouseAnnotation,
            reuseIdentifier: WarehouseMarkerView.reuseIdentifier
        )
        view.annotation = warehouseAnnotation
        return view
    }
    return nil
}`
        }
      ]
    },
    {
      id: 'stop-marker',
      title: 'Marcador de Parada (Simple)',
      description: 'Marcador circular numerado para representar paradas con una sola orden. El color puede variar segun la zona asignada.',
      preview: `
+------------------+
|                  |
|    +------+      |
|    |  1   |      |  <- Circulo con color de zona
|    +------+      |     Numero centrado en blanco
|                  |
+------------------+

Color: Dinamico (ej: #3B82F6 Azul)
Borde: 3px blanco
Tamano: 32x32px
Fuente: Bold 13px blanco
Sombra: rgba(0,0,0,0.3)
`,
      examples: [
        {
          language: 'flutter',
          label: 'Flutter',
          code: `// Marcador de Parada Simple - Flutter/Dart
import 'package:flutter/material.dart';

class StopMarker extends StatelessWidget {
  final int stopNumber;
  final Color zoneColor;

  const StopMarker({
    Key? key,
    required this.stopNumber,
    this.zoneColor = const Color(0xFF3B82F6), // Azul por defecto
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: zoneColor,
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white,
          width: 3,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Center(
        child: Text(
          stopNumber.toString(),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}

// Colores de zona disponibles
class ZoneColors {
  static const Color blue = Color(0xFF3B82F6);
  static const Color red = Color(0xFFEF4444);
  static const Color green = Color(0xFF10B981);
  static const Color orange = Color(0xFFF97316);
  static const Color purple = Color(0xFF8B5CF6);
  static const Color pink = Color(0xFFEC4899);
  static const Color yellow = Color(0xFFEAB308);
  static const Color cyan = Color(0xFF06B6D4);

  static Color fromHex(String hexColor) {
    hexColor = hexColor.replaceAll('#', '');
    return Color(int.parse('FF\$hexColor', radix: 16));
  }
}

// Uso
StopMarker(
  stopNumber: 1,
  zoneColor: ZoneColors.blue,
)`
        },
        {
          language: 'kotlin',
          label: 'Kotlin',
          code: `// Marcador de Parada Simple - Android/Kotlin
import android.content.Context
import android.graphics.*
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory

class StopMarkerGenerator(private val context: Context) {

    companion object {
        private const val MARKER_SIZE = 32 // dp
        private const val BORDER_WIDTH = 3f // dp
        private const val FONT_SIZE = 13f // sp
    }

    // Colores de zona predefinidos
    object ZoneColors {
        const val BLUE = 0xFF3B82F6.toInt()
        const val RED = 0xFFEF4444.toInt()
        const val GREEN = 0xFF10B981.toInt()
        const val ORANGE = 0xFFF97316.toInt()
        const val PURPLE = 0xFF8B5CF6.toInt()
        const val PINK = 0xFFEC4899.toInt()
        const val YELLOW = 0xFFEAB308.toInt()
        const val CYAN = 0xFF06B6D4.toInt()

        fun fromHex(hexColor: String): Int {
            return Color.parseColor(hexColor)
        }
    }

    fun createStopMarker(
        stopNumber: Int,
        zoneColor: Int = ZoneColors.BLUE
    ): BitmapDescriptor {
        val density = context.resources.displayMetrics.density
        val size = (MARKER_SIZE * density).toInt()
        val borderWidth = BORDER_WIDTH * density
        val fontSize = FONT_SIZE * density

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Sombra
        val shadowPaint = Paint().apply {
            isAntiAlias = true
            color = Color.argb(76, 0, 0, 0)
            maskFilter = BlurMaskFilter(8f * density, BlurMaskFilter.Blur.NORMAL)
        }
        canvas.drawCircle(
            size / 2f,
            size / 2f + 3f * density,
            size / 2f - borderWidth,
            shadowPaint
        )

        // Circulo con color de zona
        val circlePaint = Paint().apply {
            isAntiAlias = true
            color = zoneColor
            style = Paint.Style.FILL
        }
        canvas.drawCircle(
            size / 2f,
            size / 2f,
            size / 2f - borderWidth,
            circlePaint
        )

        // Borde blanco
        val borderPaint = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = borderWidth
        }
        canvas.drawCircle(
            size / 2f,
            size / 2f,
            size / 2f - borderWidth / 2,
            borderPaint
        )

        // Numero de parada
        val textPaint = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            textSize = fontSize
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        val textBounds = Rect()
        val text = stopNumber.toString()
        textPaint.getTextBounds(text, 0, text.length, textBounds)
        canvas.drawText(
            text,
            size / 2f,
            size / 2f + textBounds.height() / 2f,
            textPaint
        )

        return BitmapDescriptorFactory.fromBitmap(bitmap)
    }
}

// Uso
val generator = StopMarkerGenerator(context)
val marker = googleMap.addMarker(
    MarkerOptions()
        .position(LatLng(stopLatitude, stopLongitude))
        .icon(generator.createStopMarker(1, StopMarkerGenerator.ZoneColors.BLUE))
        .title("Parada 1")
        .snippet(stopAddress)
)`
        },
        {
          language: 'swift',
          label: 'Swift',
          code: `// Marcador de Parada Simple - iOS/Swift
import UIKit
import MapKit

// Colores de zona
enum ZoneColor {
    case blue, red, green, orange, purple, pink, yellow, cyan
    case custom(String)

    var uiColor: UIColor {
        switch self {
        case .blue: return UIColor(hex: "#3B82F6")
        case .red: return UIColor(hex: "#EF4444")
        case .green: return UIColor(hex: "#10B981")
        case .orange: return UIColor(hex: "#F97316")
        case .purple: return UIColor(hex: "#8B5CF6")
        case .pink: return UIColor(hex: "#EC4899")
        case .yellow: return UIColor(hex: "#EAB308")
        case .cyan: return UIColor(hex: "#06B6D4")
        case .custom(let hex): return UIColor(hex: hex)
        }
    }
}

extension UIColor {
    convenience init(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&rgb)

        self.init(
            red: CGFloat((rgb & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((rgb & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(rgb & 0x0000FF) / 255.0,
            alpha: 1.0
        )
    }
}

class StopMarkerView: MKAnnotationView {

    static let reuseIdentifier = "StopMarker"

    var stopNumber: Int = 1 {
        didSet { updateImage() }
    }

    var zoneColor: ZoneColor = .blue {
        didSet { updateImage() }
    }

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setupMarker()
    }

    required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        setupMarker()
    }

    private func setupMarker() {
        frame = CGRect(x: 0, y: 0, width: 32, height: 32)
        centerOffset = CGPoint(x: 0, y: -16)
        canShowCallout = true
        updateImage()
    }

    private func updateImage() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32))
        image = renderer.image { context in
            let rect = CGRect(x: 0, y: 0, width: 32, height: 32)
            let circlePath = UIBezierPath(ovalIn: rect.insetBy(dx: 3, dy: 3))

            // Sombra
            context.cgContext.setShadow(
                offset: CGSize(width: 0, height: 3),
                blur: 8,
                color: UIColor.black.withAlphaComponent(0.3).cgColor
            )

            // Relleno con color de zona
            zoneColor.uiColor.setFill()
            circlePath.fill()

            // Quitar sombra para el borde
            context.cgContext.setShadow(offset: .zero, blur: 0)

            // Borde blanco
            UIColor.white.setStroke()
            circlePath.lineWidth = 3
            circlePath.stroke()

            // Numero
            let text = "\\(stopNumber)" as NSString
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 13),
                .foregroundColor: UIColor.white
            ]
            let textSize = text.size(withAttributes: attributes)
            let textRect = CGRect(
                x: (32 - textSize.width) / 2,
                y: (32 - textSize.height) / 2,
                width: textSize.width,
                height: textSize.height
            )
            text.draw(in: textRect, withAttributes: attributes)
        }
    }
}

// Annotation personalizada
class StopAnnotation: NSObject, MKAnnotation {
    let coordinate: CLLocationCoordinate2D
    let title: String?
    let subtitle: String?
    let stopNumber: Int
    let zoneColor: ZoneColor

    init(
        coordinate: CLLocationCoordinate2D,
        stopNumber: Int,
        address: String,
        zoneColor: ZoneColor = .blue
    ) {
        self.coordinate = coordinate
        self.title = "Parada \\(stopNumber)"
        self.subtitle = address
        self.stopNumber = stopNumber
        self.zoneColor = zoneColor
    }
}`
        }
      ]
    },
    {
      id: 'stop-marker-multi',
      title: 'Marcador de Parada (Multiple)',
      description: 'Marcador para paradas con multiples ordenes. Incluye un badge rojo con el conteo de ordenes.',
      preview: `
+------------------+
|           +--+   |
|    +------+ 3|   |  <- Badge rojo con numero
|    |  1   +--+   |     de ordenes
|    +------+      |
|                  |  <- Circulo principal con
+------------------+     numero de parada

Circulo Principal:
  Color: Dinamico (zona)
  Tamano: 32x32px

Badge (Ordenes):
  Color: Gradiente rojo (#EF4444 -> #DC2626)
  Tamano: 20x20px
  Posicion: Superior derecha
  Borde: 2px blanco
`,
      examples: [
        {
          language: 'flutter',
          label: 'Flutter',
          code: `// Marcador de Parada Multiple - Flutter/Dart
import 'package:flutter/material.dart';

class MultiOrderStopMarker extends StatelessWidget {
  final int stopNumber;
  final int ordersCount;
  final Color zoneColor;

  const MultiOrderStopMarker({
    Key? key,
    required this.stopNumber,
    required this.ordersCount,
    this.zoneColor = const Color(0xFF3B82F6),
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 36,
      height: 36,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Circulo principal
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: zoneColor,
              shape: BoxShape.circle,
              border: Border.all(
                color: Colors.white,
                width: 3,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Center(
              child: Text(
                stopNumber.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),
          ),

          // Badge con numero de ordenes
          Positioned(
            top: -4,
            right: -4,
            child: Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFFEF4444), // Rojo claro
                    Color(0xFFDC2626), // Rojo oscuro
                  ],
                ),
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white,
                  width: 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFEF4444).withOpacity(0.4),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  ordersCount.toString(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Widget inteligente que decide que marcador usar
class StopMarkerWidget extends StatelessWidget {
  final int stopNumber;
  final int ordersCount;
  final Color zoneColor;

  const StopMarkerWidget({
    Key? key,
    required this.stopNumber,
    this.ordersCount = 1,
    this.zoneColor = const Color(0xFF3B82F6),
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (ordersCount > 1) {
      return MultiOrderStopMarker(
        stopNumber: stopNumber,
        ordersCount: ordersCount,
        zoneColor: zoneColor,
      );
    }
    return StopMarker(
      stopNumber: stopNumber,
      zoneColor: zoneColor,
    );
  }
}`
        },
        {
          language: 'kotlin',
          label: 'Kotlin',
          code: `// Marcador de Parada Multiple - Android/Kotlin
import android.content.Context
import android.graphics.*
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory

class MultiOrderStopMarkerGenerator(private val context: Context) {

    companion object {
        private const val MARKER_SIZE = 36 // dp (mas grande para el badge)
        private const val MAIN_CIRCLE_SIZE = 32 // dp
        private const val BADGE_SIZE = 20 // dp
        private const val BORDER_WIDTH = 3f // dp
        private const val BADGE_BORDER_WIDTH = 2f // dp
    }

    fun createMultiOrderMarker(
        stopNumber: Int,
        ordersCount: Int,
        zoneColor: Int = StopMarkerGenerator.ZoneColors.BLUE
    ): BitmapDescriptor {
        val density = context.resources.displayMetrics.density
        val size = (MARKER_SIZE * density).toInt()
        val mainCircleSize = (MAIN_CIRCLE_SIZE * density).toInt()
        val badgeSize = (BADGE_SIZE * density).toInt()
        val borderWidth = BORDER_WIDTH * density
        val badgeBorderWidth = BADGE_BORDER_WIDTH * density

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val mainCenterX = mainCircleSize / 2f
        val mainCenterY = size - mainCircleSize / 2f

        // Sombra del circulo principal
        val shadowPaint = Paint().apply {
            isAntiAlias = true
            color = Color.argb(76, 0, 0, 0)
            maskFilter = BlurMaskFilter(8f * density, BlurMaskFilter.Blur.NORMAL)
        }
        canvas.drawCircle(
            mainCenterX,
            mainCenterY + 3f * density,
            mainCircleSize / 2f - borderWidth,
            shadowPaint
        )

        // Circulo principal con color de zona
        val circlePaint = Paint().apply {
            isAntiAlias = true
            color = zoneColor
            style = Paint.Style.FILL
        }
        canvas.drawCircle(
            mainCenterX,
            mainCenterY,
            mainCircleSize / 2f - borderWidth,
            circlePaint
        )

        // Borde blanco del circulo principal
        val borderPaint = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = borderWidth
        }
        canvas.drawCircle(
            mainCenterX,
            mainCenterY,
            mainCircleSize / 2f - borderWidth / 2,
            borderPaint
        )

        // Numero de parada
        val textPaint = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            textSize = 13f * density
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        val textBounds = Rect()
        val stopText = stopNumber.toString()
        textPaint.getTextBounds(stopText, 0, stopText.length, textBounds)
        canvas.drawText(
            stopText,
            mainCenterX,
            mainCenterY + textBounds.height() / 2f,
            textPaint
        )

        // Badge rojo
        val badgeCenterX = size - badgeSize / 2f
        val badgeCenterY = badgeSize / 2f

        // Gradiente rojo para el badge
        val badgeGradient = LinearGradient(
            badgeCenterX - badgeSize / 2f,
            badgeCenterY - badgeSize / 2f,
            badgeCenterX + badgeSize / 2f,
            badgeCenterY + badgeSize / 2f,
            intArrayOf(0xFFEF4444.toInt(), 0xFFDC2626.toInt()),
            null,
            Shader.TileMode.CLAMP
        )

        val badgePaint = Paint().apply {
            isAntiAlias = true
            shader = badgeGradient
            style = Paint.Style.FILL
        }

        // Sombra del badge
        val badgeShadowPaint = Paint().apply {
            isAntiAlias = true
            color = Color.argb(102, 239, 68, 68) // 0.4 opacity
            maskFilter = BlurMaskFilter(6f * density, BlurMaskFilter.Blur.NORMAL)
        }
        canvas.drawCircle(
            badgeCenterX,
            badgeCenterY + 2f * density,
            badgeSize / 2f - badgeBorderWidth,
            badgeShadowPaint
        )

        canvas.drawCircle(
            badgeCenterX,
            badgeCenterY,
            badgeSize / 2f - badgeBorderWidth,
            badgePaint
        )

        // Borde blanco del badge
        val badgeBorderPaint = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = badgeBorderWidth
        }
        canvas.drawCircle(
            badgeCenterX,
            badgeCenterY,
            badgeSize / 2f - badgeBorderWidth / 2,
            badgeBorderPaint
        )

        // Numero de ordenes
        val badgeTextPaint = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            textSize = 10f * density
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        val badgeTextBounds = Rect()
        val ordersText = ordersCount.toString()
        badgeTextPaint.getTextBounds(ordersText, 0, ordersText.length, badgeTextBounds)
        canvas.drawText(
            ordersText,
            badgeCenterX,
            badgeCenterY + badgeTextBounds.height() / 2f,
            badgeTextPaint
        )

        return BitmapDescriptorFactory.fromBitmap(bitmap)
    }
}

// Factory inteligente que decide que marcador usar
class StopMarkerFactory(private val context: Context) {
    private val singleGenerator = StopMarkerGenerator(context)
    private val multiGenerator = MultiOrderStopMarkerGenerator(context)

    fun createMarker(
        stopNumber: Int,
        ordersCount: Int,
        zoneColor: Int = StopMarkerGenerator.ZoneColors.BLUE
    ): BitmapDescriptor {
        return if (ordersCount > 1) {
            multiGenerator.createMultiOrderMarker(stopNumber, ordersCount, zoneColor)
        } else {
            singleGenerator.createStopMarker(stopNumber, zoneColor)
        }
    }
}`
        },
        {
          language: 'swift',
          label: 'Swift',
          code: `// Marcador de Parada Multiple - iOS/Swift
import UIKit
import MapKit

class MultiOrderStopMarkerView: MKAnnotationView {

    static let reuseIdentifier = "MultiOrderStopMarker"

    var stopNumber: Int = 1 {
        didSet { updateImage() }
    }

    var ordersCount: Int = 1 {
        didSet { updateImage() }
    }

    var zoneColor: ZoneColor = .blue {
        didSet { updateImage() }
    }

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setupMarker()
    }

    required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        setupMarker()
    }

    private func setupMarker() {
        frame = CGRect(x: 0, y: 0, width: 36, height: 36)
        centerOffset = CGPoint(x: 0, y: -18)
        canShowCallout = true
        updateImage()
    }

    private func updateImage() {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 36, height: 36))
        image = renderer.image { context in
            // Circulo principal (32x32, posicionado en la esquina inferior izquierda)
            let mainRect = CGRect(x: 0, y: 4, width: 32, height: 32)
            let mainPath = UIBezierPath(ovalIn: mainRect.insetBy(dx: 3, dy: 3))

            // Sombra del circulo principal
            context.cgContext.setShadow(
                offset: CGSize(width: 0, height: 3),
                blur: 8,
                color: UIColor.black.withAlphaComponent(0.3).cgColor
            )

            zoneColor.uiColor.setFill()
            mainPath.fill()

            context.cgContext.setShadow(offset: .zero, blur: 0)

            UIColor.white.setStroke()
            mainPath.lineWidth = 3
            mainPath.stroke()

            // Numero de parada
            let stopText = "\\(stopNumber)" as NSString
            let stopAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 13),
                .foregroundColor: UIColor.white
            ]
            let stopTextSize = stopText.size(withAttributes: stopAttributes)
            let stopTextRect = CGRect(
                x: (32 - stopTextSize.width) / 2,
                y: 4 + (32 - stopTextSize.height) / 2,
                width: stopTextSize.width,
                height: stopTextSize.height
            )
            stopText.draw(in: stopTextRect, withAttributes: stopAttributes)

            // Badge rojo (20x20, esquina superior derecha)
            let badgeRect = CGRect(x: 16, y: 0, width: 20, height: 20)
            let badgePath = UIBezierPath(ovalIn: badgeRect.insetBy(dx: 2, dy: 2))

            // Sombra del badge
            context.cgContext.setShadow(
                offset: CGSize(width: 0, height: 2),
                blur: 6,
                color: UIColor(hex: "#EF4444").withAlphaComponent(0.4).cgColor
            )

            // Gradiente rojo
            let colors = [
                UIColor(hex: "#EF4444").cgColor,
                UIColor(hex: "#DC2626").cgColor
            ]
            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: colors as CFArray,
                locations: [0, 1]
            )!

            context.cgContext.saveGState()
            context.cgContext.addPath(badgePath.cgPath)
            context.cgContext.clip()
            context.cgContext.drawLinearGradient(
                gradient,
                start: CGPoint(x: 16, y: 0),
                end: CGPoint(x: 36, y: 20),
                options: []
            )
            context.cgContext.restoreGState()

            context.cgContext.setShadow(offset: .zero, blur: 0)

            // Borde blanco del badge
            UIColor.white.setStroke()
            badgePath.lineWidth = 2
            badgePath.stroke()

            // Numero de ordenes
            let ordersText = "\\(ordersCount)" as NSString
            let ordersAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 10),
                .foregroundColor: UIColor.white
            ]
            let ordersTextSize = ordersText.size(withAttributes: ordersAttributes)
            let ordersTextRect = CGRect(
                x: 16 + (20 - ordersTextSize.width) / 2,
                y: (20 - ordersTextSize.height) / 2,
                width: ordersTextSize.width,
                height: ordersTextSize.height
            )
            ordersText.draw(in: ordersTextRect, withAttributes: ordersAttributes)
        }
    }
}

// Factory para crear el marcador apropiado
class StopMarkerFactory {

    static func createMarker(
        for annotation: StopAnnotation,
        in mapView: MKMapView
    ) -> MKAnnotationView {
        if annotation.ordersCount > 1 {
            let view = mapView.dequeueReusableAnnotationView(
                withIdentifier: MultiOrderStopMarkerView.reuseIdentifier
            ) as? MultiOrderStopMarkerView ?? MultiOrderStopMarkerView(
                annotation: annotation,
                reuseIdentifier: MultiOrderStopMarkerView.reuseIdentifier
            )
            view.annotation = annotation
            view.stopNumber = annotation.stopNumber
            view.ordersCount = annotation.ordersCount
            view.zoneColor = annotation.zoneColor
            return view
        } else {
            let view = mapView.dequeueReusableAnnotationView(
                withIdentifier: StopMarkerView.reuseIdentifier
            ) as? StopMarkerView ?? StopMarkerView(
                annotation: annotation,
                reuseIdentifier: StopMarkerView.reuseIdentifier
            )
            view.annotation = annotation
            view.stopNumber = annotation.stopNumber
            view.zoneColor = annotation.zoneColor
            return view
        }
    }
}

// Annotation extendida
class StopAnnotation: NSObject, MKAnnotation {
    let coordinate: CLLocationCoordinate2D
    let title: String?
    let subtitle: String?
    let stopNumber: Int
    let ordersCount: Int
    let zoneColor: ZoneColor

    init(
        coordinate: CLLocationCoordinate2D,
        stopNumber: Int,
        ordersCount: Int = 1,
        address: String,
        zoneColor: ZoneColor = .blue
    ) {
        self.coordinate = coordinate
        self.title = ordersCount > 1
            ? "Parada \\(stopNumber) (\\(ordersCount) ordenes)"
            : "Parada \\(stopNumber)"
        self.subtitle = address
        self.stopNumber = stopNumber
        self.ordersCount = ordersCount
        self.zoneColor = zoneColor
    }
}`
        }
      ]
    }
  ]
}

// Exportar todas las secciones de componentes
export const componentSections: ComponentSection[] = [
  mapComponents
]
