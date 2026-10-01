import { render, screen, fireEvent } from '@testing-library/react'
import { DateField } from '@/components/ui/DateField'
import { describe, it, expect, vi } from 'vitest'

// react-native-web siempre resuelve Platform.OS === 'web' bajo jsdom,
// así que aquí se ejercita el camino web (input DOM nativo).

describe('DateField', () => {
    it('renderiza un input DOM real con type="date" en web', () => {
        render(<DateField label="Tu cumpleaños" value="" onChange={() => {}} />)

        const input = document.querySelector('input') as HTMLInputElement
        expect(input).not.toBeNull()
        expect(input.type).toBe('date')
        expect(input.value).toBe('')
    })

    it('expone un nombre accesible derivado del label', () => {
        render(<DateField label="Tu cumpleaños" value="" onChange={() => {}} />)

        const input = screen.getByLabelText('Tu cumpleaños')
        expect(input).toBeInTheDocument()
    })

    it('llama a onChange con el valor YYYY-MM-DD elegido', () => {
        const onChange = vi.fn()
        render(<DateField label="Tu cumpleaños" value="" onChange={onChange} />)

        const input = screen.getByLabelText('Tu cumpleaños')
        fireEvent.change(input, { target: { value: '1990-04-12' } })

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith('1990-04-12')
    })

    it('informa cadena vacía cuando se limpia el input', () => {
        const onChange = vi.fn()
        render(<DateField label="Tu cumpleaños" value="1990-04-12" onChange={onChange} />)

        const input = screen.getByLabelText('Tu cumpleaños') as HTMLInputElement

        // El valor renderizado refleja la prop: un input incontrolado no la
        // reflejaría y esta aserción fallaría.
        expect(input.value).toBe('1990-04-12')

        fireEvent.change(input, { target: { value: '' } })

        expect(onChange).toHaveBeenCalledWith('')
    })
})
