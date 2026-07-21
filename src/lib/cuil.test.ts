import { describe, it, expect } from 'vitest'
import { validarCuil, formatearCuil } from './cuil'

describe('validarCuil', () => {
  it('acepta 11 dígitos sin separadores', () => {
    expect(validarCuil('20345678911')).toBe(true)
    expect(validarCuil('20123456783')).toBe(true)
  })

  it('acepta formato XX-XXXXXXXX-X', () => {
    expect(validarCuil('20-12345678-6')).toBe(true)
    expect(validarCuil('27-30000000-8')).toBe(true)
  })

  it('rechaza strings con longitud incorrecta', () => {
    expect(validarCuil('20-1234567-3')).toBe(false)
    expect(validarCuil('20-123456789-3')).toBe(false)
    expect(validarCuil('1234567890')).toBe(false)
    expect(validarCuil('')).toBe(false)
  })

  it('rechaza strings con guiones mal ubicados', () => {
    expect(validarCuil('201-2345678-3')).toBe(false)
    expect(validarCuil('20-1234567-89')).toBe(false)
    expect(validarCuil('2012345678-3')).toBe(false)
  })

  it('rechaza strings con caracteres no numéricos', () => {
    expect(validarCuil('20-ABCDEFGH-3')).toBe(false)
    expect(validarCuil('AA-12345678-3')).toBe(false)
    expect(validarCuil('2012345678A')).toBe(false)
  })
})

describe('formatearCuil', () => {
  it('formatea 11 dígitos a XX-XXXXXXXX-X', () => {
    expect(formatearCuil('20123456783')).toBe('20-12345678-3')
  })

  it('devuelve tal cual si no tiene 11 dígitos', () => {
    expect(formatearCuil('12345')).toBe('12345')
  })

  it('formatea aunque venga ya con guiones', () => {
    expect(formatearCuil('20-12345678-3')).toBe('20-12345678-3')
  })
})
