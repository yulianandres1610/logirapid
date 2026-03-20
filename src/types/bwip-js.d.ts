declare module 'bwip-js' {
  interface ToBufferOptions {
    bcid: string
    text: string
    scale?: number
    height?: number
    width?: number
    includetext?: boolean
    textxalign?: string
    textyalign?: string
    textsize?: number
    padding?: number
    paddingwidth?: number
    paddingheight?: number
    backgroundcolor?: string
    barcolor?: string
    textcolor?: string
    [key: string]: any
  }

  function toBuffer(options: ToBufferOptions): Promise<Buffer>
  export { toBuffer }
  export default { toBuffer }
}
