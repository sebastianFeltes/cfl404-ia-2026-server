import prisma from './prisma.js'

/** Contenido institucional de la app. La tabla setting puede pisar estos valores. */
export const DEFAULT_BENEFICIOS = [
  {
    id: 1,
    nombre: 'Ferretería Berisso',
    rubro: 'Ferretería, Herramientas, Construcción',
    direccion: 'Av. Montevideo 2100',
    descuento: '10% OFF',
    descuentoDetalle: '10% de descuento abonando en efectivo o transferencia para alumnos y personal del CFL 404.',
    telefono: '5492213192360',
    descripcion: 'Todo lo que necesitás para tus proyectos de construcción y hogar. Herramientas eléctricas, pintura, y accesorios de alta calidad con la mejor atención de la zona.',
    catalogo: [
      'Herramientas manuales y eléctricas',
      'Pinturas de exterior/interior y accesorios',
      'Bulonería, tornillería y fijaciones',
      'Materiales eléctricos básicos y grifería',
    ],
  },
  {
    id: 2,
    nombre: 'Ropa Casual Luz',
    rubro: 'Indumentaria, Calzado, Ropa',
    direccion: 'Calle 12 550',
    descuento: '15% OFF',
    descuentoDetalle: '15% de descuento en indumentaria seleccionada los días miércoles presentando credencial del CFL 404.',
    telefono: '5492213192360',
    descripcion: 'Moda casual y deportiva para todas las edades. Las últimas tendencias con la mejor relación calidad-precio y una atención personalizada.',
    catalogo: [
      'Jeans y Pantalones de gabardina',
      'Remeras lisas y estampadas',
      'Buzos y Camperas de abrigo',
      'Accesorios (cinturones, gorras)',
    ],
  },
  {
    id: 3,
    nombre: 'Almacén "Don Luis"',
    rubro: 'Almacén, Comida, Fiambrería, Kiosco',
    direccion: 'Calle 14 102',
    descuento: '10% OFF',
    descuentoDetalle: '10% de descuento en compras superiores a $5000 abonando en efectivo.',
    telefono: '5492213192360',
    descripcion: 'Tu almacén de confianza en el barrio. Ofrecemos fiambres seleccionados de primera calidad, lácteos, panadería fresca y todo tipo de productos de almacén general.',
    catalogo: [
      'Fiambrería y Quesos por peso',
      'Bebidas con y sin alcohol',
      'Lácteos frescos y panificados',
      'Artículos de limpieza y perfumería',
    ],
  },
  {
    id: 4,
    nombre: 'Librería Estudiantil',
    rubro: 'Librería, Papelería, Útiles, Fotocopias',
    direccion: 'Av. Montevideo 1420',
    descuento: '12% OFF',
    descuentoDetalle: '12% de descuento en fotocopias, impresiones y útiles escolares para estudiantes y docentes del centro.',
    telefono: '5492213192360',
    descripcion: 'Especialistas en fotocopias, anillados, impresiones en alta calidad e insumos escolares. Encontrá todas las carpetas, cuadernos y apuntes que necesitás.',
    catalogo: [
      'Fotocopias e Impresiones A4 / Oficio',
      'Anillados, encuadernaciones y plastificados',
      'Cuadernos y carpetas escolares',
      'Insumos de computación y cartuchos',
    ],
  },
  {
    id: 5,
    nombre: 'Pinturería del Puerto',
    rubro: 'Pinturería, Decoración, Construcción',
    direccion: 'Calle 8 esq. 162',
    descuento: '20% OFF',
    descuentoDetalle: '20% de descuento en pinturas para el hogar (látex y esmaltes) de marcas seleccionadas abonando en efectivo.',
    telefono: '5492213192360',
    descripcion: 'Distribuidor oficial de primeras marcas. Te asesoramos técnicamente en la elección del mejor producto para renovar tus espacios interiores y exteriores.',
    catalogo: [
      'Látex interior y exterior premium',
      'Esmaltes sintéticos y barnices',
      'Pinceles, rodillos y cintas de enmascarar',
      'Tratamientos para madera y metal',
    ],
  },
]

export const DEFAULT_CONTACTO = {
  phone: '0800-348-0111',
  phoneRaw: 'tel:08003480111',
  email: 'cfp404berisso@abc.gob.ar',
  address: 'Calle La Portada N.º 4120 (Acceso 4 al Puerto)',
  city: 'Berisso, Buenos Aires, Argentina',
  schedule: 'Lunes a Viernes de 08:00 a 21:00 hs',
  institutionName: 'Centro de Formación Laboral N.º 404',
  social: {
    instagram: 'https://www.instagram.com/cfl404berisso',
    youtube: 'https://www.youtube.com/channel/UC6S14E5C0nE2ey8poEq8AZQ/featured',
    facebook: 'https://www.facebook.com/cfl404berisso/',
    tiktok: 'https://www.tiktok.com/@cfl404berisso',
    twitterX: 'https://twitter.com/cfl404berisso',
    email: 'mailto:cfp404berisso@abc.gob.ar',
    whatsapp: 'https://wa.me/5492213192360',
    whatsappRaw: '5492213192360',
    phone: 'tel:08003480111',
  },
}

export const DEFAULT_AYUDA = [
  {
    id: 'qr',
    icon: 'qr-code-outline',
    title: 'Credencial Digital y Código QR',
    description: 'Tu credencial contiene un código QR único que te identifica como alumno activo. Al ingresar al centro o aula, preséntala ante el preceptor para registrar tu presentismo.',
    important: 'El alumno no marca asistencia con un botón; la lectura la realiza el personal docente o preceptoría.',
  },
  {
    id: 'cursos',
    icon: 'school-outline',
    title: 'Seguimiento de Cursada y Faltas',
    description: 'En Inicio y en Mis cursos ves las cursadas en las que estás inscripto, con aula, docente y el límite de inasistencias.',
    important: 'Dentro de cada curso, el botón Ver Asistencia muestra las faltas restantes y el historial de clases.',
  },
  {
    id: 'justificaciones',
    icon: 'document-text-outline',
    title: 'Justificación de Inasistencias',
    description: 'Si te ausentaste por motivos de salud o laborales, presentá el certificado en la preceptoría del centro dentro de las 48 horas hábiles.',
    important: 'Las inasistencias justificadas quedan en el historial y no descuentan del límite de faltas.',
  },
  {
    id: 'contacto',
    icon: 'chatbubble-ellipses-outline',
    title: 'Atención al Alumno y Soporte',
    description: 'Para consultas administrativas, constancias de alumno regular o dudas sobre la plataforma, usá los canales de la sección Contacto.',
    important: 'Atención presencial y telefónica: Lunes a Viernes de 08:00 a 21:00 hs.',
  },
]

export const DEFAULT_ACERCA = {
  appName: 'CFL 404',
  institution: 'Centro de Formación Laboral N.º 404',
  campus: 'Sede Berisso',
  summary: 'Credencial, asistencia, cursos, beneficios y cooperadora para alumnos del centro.',
  creators: [
    {
      name: 'Equipo del CFL N.º 404',
      role: 'Desarrollo de la aplicación para alumnos',
    },
  ],
  support: {
    email: 'cfp404berisso@abc.gob.ar',
    mailto: 'mailto:cfp404berisso@abc.gob.ar?subject=Soporte%20app%20CFL%20404',
    detail: 'Consultas sobre el uso de la aplicación',
  },
  rate: {
    title: 'Calificanos',
    description: 'Si la app te resulta útil, dejá tu valoración cuando esté publicada en la tienda.',
    androidUrl: null,
    iosUrl: null,
  },
}

export const DEFAULT_COOPERADORA = {
  banco: 'Banco Provincia de Buenos Aires',
  alias: 'coop.cfl.404',
  cbu: '0140032801503305438550',
  cuit: '30-71753985-7',
  whatsappNumber: '5492213192360',
  whatsappMessage: 'Hola, me contacto para enviar el comprobante de transferencia para la Cooperadora del CFL 404.',
  monthlyAmount: 3000,
}

export const MOBILE_SETTING_KEYS = {
  beneficios: 'mobile.beneficios',
  contacto: 'mobile.contacto',
  ayuda: 'mobile.ayuda',
  cooperadora: 'mobile.cooperadora',
  acerca: 'mobile.acerca',
}

export async function readMobileSetting(key, fallback) {
  const row = await prisma.setting.findUnique({ where: { key } })
  if (!row?.value) return fallback
  try {
    const parsed = JSON.parse(row.value)
    if (parsed === null || typeof parsed !== 'object') return fallback
    return parsed
  } catch {
    return fallback
  }
}
