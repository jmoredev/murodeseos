"use strict";
/**
 * Script completo para resetear y poblar la base de datos de prueba
 * Crea: usuarios, perfiles, grupos, membresías y listas de deseos
 *
 * Uso: npx tsx scripts/seed-complete-database.ts
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
// Cargar variables de entorno
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env.local') });
var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno');
    process.exit(1);
}
var supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});
// Datos de usuarios
var USERS = [
    { email: 'juan@test.com', password: 'Test123!', displayName: 'Juan Pérez', avatar: '👨‍💻', shirtSize: 'L', pantsSize: '42', shoeSize: '43', favoriteBrands: 'Nike, Adidas', favoriteColor: 'Azul' },
    { email: 'maria@test.com', password: 'Test123!', displayName: 'María García', avatar: '👩‍💼', shirtSize: 'M', pantsSize: '38', shoeSize: '39', favoriteBrands: 'Zara, Mango', favoriteColor: 'Rojo' },
    { email: 'ana@test.com', password: 'Test123!', displayName: 'Ana López', avatar: '👩‍🎨', shirtSize: 'S', pantsSize: '36', shoeSize: '37', favoriteBrands: 'Levi\'s, Converse', favoriteColor: 'Verde' },
    { email: 'carlos@test.com', password: 'Test123!', displayName: 'Carlos Ruiz', avatar: '👨‍🔧', shirtSize: 'XL', pantsSize: '46', shoeSize: '45', favoriteBrands: 'Vans, North Face', favoriteColor: 'Negro' },
    // Usuario E2E para tests automáticos
    { email: 'e2e-test@test.com', password: 'E2ETest123!', displayName: 'E2E Test User', avatar: '🤖', shirtSize: 'L', pantsSize: '42', shoeSize: '44', favoriteBrands: 'Google, Apple', favoriteColor: 'Gris' }
];
// Datos de grupos
var GROUPS = [
    { id: 'FAM001', name: 'Familia García', icon: '👨‍👩‍👧‍👦', creatorEmail: 'maria@test.com' },
    { id: 'WORK01', name: 'Amigos del Trabajo', icon: '💼', creatorEmail: 'juan@test.com' },
    { id: 'BOOK01', name: 'Club de Lectura', icon: '📚', creatorEmail: 'ana@test.com' },
    // Grupo E2E para tests automáticos
    { id: 'E2E001', name: 'E2E Test Group', icon: '🧪', creatorEmail: 'e2e-test@test.com' }
];
// Datos de wishlist items
var WISHLIST_ITEMS = [
    { title: 'Auriculares Sony WH-1000XM5', price: '349.00', image_url: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=500', priority: 'high' },
    { title: 'Libro: El Archivo de las Tormentas', price: '25.00', image_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=500', priority: 'medium' },
    { title: 'Zapatillas Nike Air Max', price: '120.00', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=500', priority: 'high' },
    { title: 'Cafetera Italiana Bialetti', price: '35.00', image_url: 'https://images.unsplash.com/photo-1561882468-489833355708?auto=format&fit=crop&q=80&w=500', priority: 'low' },
    { title: 'Set de LEGO Star Wars', price: '89.99', image_url: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?auto=format&fit=crop&q=80&w=500', priority: 'medium' }
];
// Wishlist items predecibles para usuario E2E
var E2E_WISHLIST_ITEMS = [
    { title: 'E2E Test Item 1', price: '100.00', image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=500', priority: 'high' },
    { title: 'E2E Test Item 2', price: '50.00', image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=500', priority: 'medium' },
    { title: 'E2E Test Item 3', price: '25.00', image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=500', priority: 'low' }
];
function cleanDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var allUsers, _i, _a, user;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🗑️  Limpiando base de datos...\n');
                    // Eliminar en orden correcto (respetando foreign keys)
                    return [4 /*yield*/, supabase.from('wishlist_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')];
                case 1:
                    // Eliminar en orden correcto (respetando foreign keys)
                    _b.sent();
                    return [4 /*yield*/, supabase.from('group_members').delete().neq('group_id', '00000000')];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, supabase.from('groups').delete().neq('id', '00000000')];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, supabase.auth.admin.listUsers()];
                case 5:
                    allUsers = (_b.sent()).data;
                    if (!(allUsers === null || allUsers === void 0 ? void 0 : allUsers.users)) return [3 /*break*/, 9];
                    _i = 0, _a = allUsers.users;
                    _b.label = 6;
                case 6:
                    if (!(_i < _a.length)) return [3 /*break*/, 9];
                    user = _a[_i];
                    return [4 /*yield*/, supabase.auth.admin.deleteUser(user.id)];
                case 7:
                    _b.sent();
                    _b.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 6];
                case 9:
                    console.log('✅ Base de datos limpiada\n');
                    return [2 /*return*/];
            }
        });
    });
}
function createUsers() {
    return __awaiter(this, void 0, void 0, function () {
        var userMap, _i, USERS_1, user, _a, newUser, error, userId, _b, profile, profileError, updateError;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('👥 Creando usuarios...\n');
                    userMap = new Map() // email -> userId
                    ;
                    _i = 0, USERS_1 = USERS;
                    _c.label = 1;
                case 1:
                    if (!(_i < USERS_1.length)) return [3 /*break*/, 7];
                    user = USERS_1[_i];
                    return [4 /*yield*/, supabase.auth.admin.createUser({
                            email: user.email,
                            password: user.password,
                            email_confirm: true,
                            user_metadata: {
                                display_name: user.displayName,
                                avatar_url: user.avatar,
                            }
                        })];
                case 2:
                    _a = _c.sent(), newUser = _a.data, error = _a.error;
                    if (error || !newUser.user) {
                        console.error("\u274C Error creando ".concat(user.email, ":"), error === null || error === void 0 ? void 0 : error.message);
                        return [3 /*break*/, 6];
                    }
                    userId = newUser.user.id;
                    userMap.set(user.email, userId);
                    // Esperar un momento para que el trigger cree el perfil
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })
                        // Verificar que el perfil se creó correctamente
                    ];
                case 3:
                    // Esperar un momento para que el trigger cree el perfil
                    _c.sent();
                    return [4 /*yield*/, supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', userId)
                            .single()];
                case 4:
                    _b = _c.sent(), profile = _b.data, profileError = _b.error;
                    if (profileError || !profile) {
                        console.error("\u274C Error: perfil no creado para ".concat(user.email));
                        return [3 /*break*/, 6];
                    }
                    return [4 /*yield*/, supabase
                            .from('profiles')
                            .update({
                            display_name: user.displayName,
                            avatar_url: user.avatar,
                            shirt_size: user.shirtSize,
                            pants_size: user.pantsSize,
                            shoe_size: user.shoeSize,
                            favorite_brands: user.favoriteBrands,
                            favorite_color: user.favoriteColor,
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', userId)];
                case 5:
                    updateError = (_c.sent()).error;
                    if (updateError) {
                        console.error("\u274C Error actualizando perfil para ".concat(user.email, ":"), updateError.message);
                        return [3 /*break*/, 6];
                    }
                    console.log("\u2705 ".concat(user.avatar, " ").concat(user.displayName, " (").concat(user.email, ")"));
                    _c.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7:
                    console.log('');
                    return [2 /*return*/, userMap];
            }
        });
    });
}
function createGroups(userMap) {
    return __awaiter(this, void 0, void 0, function () {
        var groupMap, _i, GROUPS_1, group, creatorId, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🎯 Creando grupos...\n');
                    groupMap = new Map();
                    _i = 0, GROUPS_1 = GROUPS;
                    _a.label = 1;
                case 1:
                    if (!(_i < GROUPS_1.length)) return [3 /*break*/, 4];
                    group = GROUPS_1[_i];
                    creatorId = userMap.get(group.creatorEmail);
                    if (!creatorId) {
                        console.error("\u274C No se encontr\u00F3 el creador ".concat(group.creatorEmail));
                        return [3 /*break*/, 3];
                    }
                    return [4 /*yield*/, supabase.from('groups').insert({
                            id: group.id,
                            name: group.name,
                            icon: group.icon,
                            creator_id: creatorId,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })];
                case 2:
                    error = (_a.sent()).error;
                    if (error) {
                        console.error("\u274C Error creando grupo ".concat(group.name, ":"), error.message);
                        return [3 /*break*/, 3];
                    }
                    groupMap.set(group.id, { id: group.id, creatorId: creatorId });
                    console.log("\u2705 ".concat(group.icon, " ").concat(group.name, " (").concat(group.id, ")"));
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log('');
                    return [2 /*return*/, groupMap];
            }
        });
    });
}
function createGroupMembers(userMap, groupMap) {
    return __awaiter(this, void 0, void 0, function () {
        var famGroup, workGroup, bookGroup, e2eGroup;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('👫 Asignando miembros a grupos...\n');
                    famGroup = groupMap.get('FAM001');
                    if (!famGroup) return [3 /*break*/, 2];
                    return [4 /*yield*/, supabase.from('group_members').insert([
                            { group_id: 'FAM001', user_id: famGroup.creatorId, role: 'admin', joined_at: new Date().toISOString() },
                            { group_id: 'FAM001', user_id: userMap.get('juan@test.com'), role: 'member', joined_at: new Date().toISOString() },
                            { group_id: 'FAM001', user_id: userMap.get('ana@test.com'), role: 'member', joined_at: new Date().toISOString() },
                        ])];
                case 1:
                    _a.sent();
                    console.log('✅ Familia García: María (admin), Juan, Ana');
                    _a.label = 2;
                case 2:
                    workGroup = groupMap.get('WORK01');
                    if (!workGroup) return [3 /*break*/, 4];
                    return [4 /*yield*/, supabase.from('group_members').insert([
                            { group_id: 'WORK01', user_id: workGroup.creatorId, role: 'admin', joined_at: new Date().toISOString() },
                            { group_id: 'WORK01', user_id: userMap.get('maria@test.com'), role: 'member', joined_at: new Date().toISOString() },
                            { group_id: 'WORK01', user_id: userMap.get('carlos@test.com'), role: 'member', joined_at: new Date().toISOString() },
                        ])];
                case 3:
                    _a.sent();
                    console.log('✅ Amigos del Trabajo: Juan (admin), María, Carlos');
                    _a.label = 4;
                case 4:
                    bookGroup = groupMap.get('BOOK01');
                    if (!bookGroup) return [3 /*break*/, 6];
                    return [4 /*yield*/, supabase.from('group_members').insert([
                            { group_id: 'BOOK01', user_id: bookGroup.creatorId, role: 'admin', joined_at: new Date().toISOString() },
                            { group_id: 'BOOK01', user_id: userMap.get('maria@test.com'), role: 'member', joined_at: new Date().toISOString() },
                            { group_id: 'BOOK01', user_id: userMap.get('juan@test.com'), role: 'member', joined_at: new Date().toISOString() },
                        ])];
                case 5:
                    _a.sent();
                    console.log('✅ Club de Lectura: Ana (admin), María, Juan');
                    _a.label = 6;
                case 6:
                    e2eGroup = groupMap.get('E2E001');
                    if (!e2eGroup) return [3 /*break*/, 8];
                    return [4 /*yield*/, supabase.from('group_members').insert([
                            { group_id: 'E2E001', user_id: e2eGroup.creatorId, role: 'admin', joined_at: new Date().toISOString() },
                            { group_id: 'E2E001', user_id: userMap.get('juan@test.com'), role: 'member', joined_at: new Date().toISOString() },
                        ])];
                case 7:
                    _a.sent();
                    console.log('✅ E2E Test Group: E2E Test User (admin), Juan Pérez (miembro)');
                    _a.label = 8;
                case 8:
                    console.log('');
                    return [2 /*return*/];
            }
        });
    });
}
function createWishlists(userMap) {
    return __awaiter(this, void 0, void 0, function () {
        var allUserIds, e2eUserId, _loop_1, _i, _a, _b, email, userId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('🎁 Creando listas de deseos...\n');
                    allUserIds = Array.from(userMap.values());
                    e2eUserId = userMap.get('e2e-test@test.com');
                    _loop_1 = function (email, userId) {
                        var items, numItems, i, item, reservedBy, otherUsers, error, reserved;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    items = [];
                                    // Usuario E2E: items predecibles y sin reservas
                                    if (email === 'e2e-test@test.com') {
                                        items = E2E_WISHLIST_ITEMS.map(function (item) { return ({
                                            user_id: userId,
                                            title: item.title,
                                            price: item.price,
                                            image_url: item.image_url,
                                            links: [],
                                            notes: '',
                                            priority: item.priority,
                                            reserved_by: null // Nunca reservado para tests
                                        }); });
                                    }
                                    else {
                                        numItems = Math.floor(Math.random() * 3) + 2 // 2-4 items por usuario
                                        ;
                                        for (i = 0; i < numItems; i++) {
                                            item = WISHLIST_ITEMS[Math.floor(Math.random() * WISHLIST_ITEMS.length)];
                                            reservedBy = null;
                                            if (Math.random() < 0.3) {
                                                otherUsers = allUserIds.filter(function (id) { return id !== userId; });
                                                if (otherUsers.length > 0) {
                                                    reservedBy = otherUsers[Math.floor(Math.random() * otherUsers.length)];
                                                }
                                            }
                                            items.push({
                                                user_id: userId,
                                                title: item.title,
                                                price: item.price,
                                                image_url: item.image_url,
                                                links: [],
                                                notes: '',
                                                priority: item.priority,
                                                reserved_by: reservedBy
                                            });
                                        }
                                    }
                                    return [4 /*yield*/, supabase.from('wishlist_items').insert(items)];
                                case 1:
                                    error = (_d.sent()).error;
                                    if (error) {
                                        console.error("\u274C Error creando wishlist para ".concat(email, ":"), error.message);
                                    }
                                    else {
                                        reserved = items.filter(function (i) { return i.reserved_by; }).length;
                                        console.log("\u2705 ".concat(email, ": ").concat(items.length, " deseos (").concat(reserved, " reservados)"));
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, _a = userMap.entries();
                    _c.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    _b = _a[_i], email = _b[0], userId = _b[1];
                    return [5 /*yield**/, _loop_1(email, userId)];
                case 2:
                    _c.sent();
                    _c.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log('');
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var userMap, groupMap, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🚀 INICIANDO SEED COMPLETO DE BASE DE DATOS\n');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, cleanDatabase()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, createUsers()];
                case 3:
                    userMap = _a.sent();
                    return [4 /*yield*/, createGroups(userMap)];
                case 4:
                    groupMap = _a.sent();
                    return [4 /*yield*/, createGroupMembers(userMap, groupMap)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, createWishlists(userMap)];
                case 6:
                    _a.sent();
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    console.log('✨ ¡SEED COMPLETADO EXITOSAMENTE!\n');
                    console.log('📋 Credenciales de acceso:');
                    console.log('   Todos los usuarios: password = Test123!\n');
                    console.log('👥 Usuarios creados:');
                    USERS.forEach(function (u) { return console.log("   - ".concat(u.email, " (").concat(u.displayName, ")")); });
                    console.log('\n🎯 Grupos creados:');
                    GROUPS.forEach(function (g) { return console.log("   - ".concat(g.name, " (").concat(g.id, ")")); });
                    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    return [3 /*break*/, 8];
                case 7:
                    error_1 = _a.sent();
                    console.error('❌ Error inesperado:', error_1);
                    process.exit(1);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
