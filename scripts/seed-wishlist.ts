/**
 * Script para generar items de lista de deseos para los usuarios de prueba
 * 
 * Uso:
 * 1. Asegúrate de tener .env.local con SUPABASE_SERVICE_ROLE_KEY
 * 2. Ejecuta: npx tsx scripts/seed-wishlist.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

// Datos de ejemplo para generar deseos variados
const sampleItems = [
    {
        title: 'Auriculares Sony WH-1000XM5',
        price: '349.00',
        image_url: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=500',
        links: ['https://amazon.com/sony-headphones', 'https://sony.com/headphones'],
        notes: 'Color negro preferiblemente, si no plata.',
        priority: 'high'
    },
    {
        title: 'Libro: El Archivo de las Tormentas',
        price: '25.00',
        image_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=500',
        links: ['https://amazon.com/books/sanderson'],
        notes: 'Edición tapa dura.',
        priority: 'medium'
    },
    {
        title: 'Zapatillas Nike Air Max',
        price: '120.00',
        image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=500',
        links: [],
        notes: 'Talla 42. Color blanco.',
        priority: 'high'
    },
    {
        title: 'Cafetera Italiana Bialetti',
        price: '35.00',
        image_url: 'https://images.unsplash.com/photo-1561882468-489833355708?auto=format&fit=crop&q=80&w=500',
        links: ['https://amazon.com/bialetti'],
        notes: 'Para 6 tazas.',
        priority: 'low'
    },
    {
        title: 'Set de LEGO Star Wars',
        price: '89.99',
        image_url: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?auto=format&fit=crop&q=80&w=500',
        links: ['https://lego.com/starwars'],
        notes: 'El Halcón Milenario pequeño.',
        priority: 'medium'
    },
    {
        title: 'Mochila de Senderismo',
        price: '65.00',
        image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=500',
        links: ['https://decathlon.com/backpack'],
        notes: 'Impermeable, color verde o azul.',
        priority: 'medium'
    },
    {
        title: 'Juego de Mesa: Catan',
        price: '45.00',
        image_url: 'https://images.unsplash.com/photo-1610890716171-6b1c9f2bd402?auto=format&fit=crop&q=80&w=500',
        links: [],
        notes: '',
        priority: 'low'
    },
    {
        title: 'Reloj Casio Vintage',
        price: '25.00',
        image_url: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&q=80&w=500',
        links: ['https://amazon.com/casio'],
        notes: 'El dorado clásico.',
        priority: 'high'
    }
];

function getRandomItem() {
    return sampleItems[Math.floor(Math.random() * sampleItems.length)];
}

async function seedWishlists() {
    console.log('🚀 Iniciando generación de deseos de prueba...\n');

    // 1. Obtener todos los usuarios
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError || !users || users.users.length === 0) {
        console.error('❌ Error obteniendo usuarios o no hay usuarios:', usersError);
        return;
    }

    console.log(`👥 Se encontraron ${users.users.length} usuarios.`);

    // 2. Para cada usuario, generar entre 2 y 5 deseos
    for (const user of users.users) {
        // Saltar si no es un usuario de prueba (opcional, pero seguro)
        if (!user.email?.includes('@test.com')) continue;

        console.log(`\n🎁 Generando deseos para ${user.email}...`);

        const numberOfItems = Math.floor(Math.random() * 4) + 2; // 2 a 5 items
        const itemsToInsert = [];

        for (let i = 0; i < numberOfItems; i++) {
            const item = getRandomItem();
            itemsToInsert.push({
                user_id: user.id,
                title: item.title,
                price: item.price,
                image_url: item.image_url,
                links: item.links,
                notes: item.notes,
                priority: item.priority,
                is_reserved: Math.random() > 0.8 // 20% de probabilidad de estar reservado
            });
        }

        const { error: insertError } = await supabase
            .from('wishlist_items')
            .insert(itemsToInsert);

        if (insertError) {
            console.error(`   ❌ Error insertando items para ${user.email}:`, insertError.message);
        } else {
            console.log(`   ✅ ${numberOfItems} deseos creados exitosamente.`);
        }
    }

    console.log('\n✨ ¡Proceso completado!');
}

seedWishlists().catch(console.error);
