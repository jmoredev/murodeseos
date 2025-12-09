import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function DELETE(
    request: Request,
    //Definimos params como una Promesa
    { params }: { params: Promise<{ id: string }> }
) {
    //Esperamos (await) a que params se resuelva
    const { id } = await params;
    const groupId = id;

    //Esperamos a las cookies (Requisito de Next.js 15)
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Ignoramos errores de escritura en contextos de solo lectura
                    }
                },
            },
        }
    );

    console.log(`🗑️ API: Intentando borrar grupo ${groupId}`);

    const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

    if (error) {
        console.error('Error borrando:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Grupo eliminado' }, { status: 200 });
}