export const BAIT_ROUTES = [
    '/.env',
    '/config/.env',
    '/phpmyadmin',
    '/admin/db/phpmyadmin',
    '/api/v1/auth/login'
];

export const ATTACK_SIGNATURES = {
    SQL_INJECTION: /('|--|#|\bOR\b|\bAND\b|UNION|SELECT|INSERT|DELETE)/i,
    PATH_TRAVERSAL: /(\.\.\/|\.\.\\)/i,
    XSS_ATTACK: /(<script|javascript:|onerror=|alert\()/i
};