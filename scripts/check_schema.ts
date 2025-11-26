
import { supabase } from '../lib/supabase';

async function checkSchema() {
    const { data, error } = await supabase
        .from('group_members')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching group_members:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Sample row from group_members:', data[0]);
        console.log('Keys:', Object.keys(data[0]));
    } else {
        console.log('No data found in group_members, cannot infer schema easily.');
        // Try to insert a dummy record to see errors or just assume standard fields?
        // Or we can try to select specific columns and see if it fails.

        // Let's try to select 'role' and 'is_admin'
        const { error: roleError } = await supabase.from('group_members').select('role').limit(1);
        if (!roleError) console.log('Column "role" exists.');
        else console.log('Column "role" likely does not exist:', roleError.message);

        const { error: adminError } = await supabase.from('group_members').select('is_admin').limit(1);
        if (!adminError) console.log('Column "is_admin" exists.');
        else console.log('Column "is_admin" likely does not exist:', adminError.message);
    }
}

checkSchema();
