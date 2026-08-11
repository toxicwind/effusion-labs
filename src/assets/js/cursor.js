
/**
 * Mischief Cursor Effect
 * Adds a trailing glow and interactive hover states
 */

export function initCursor() {
    const cursor = document.createElement('div');
    cursor.className = 'fixed w-4 h-4 rounded-full bg-emerald-500 mix-blend-screen pointer-events-none z-[9999] transition-transform duration-100 ease-out hidden md:block';

    const trailer = document.createElement('div');
    trailer.className = 'fixed w-8 h-8 rounded-full border border-emerald-500/50 pointer-events-none z-[9998] transition-all duration-300 ease-out hidden md:block';

    document.body.appendChild(cursor);
    document.body.appendChild(trailer);

    document.addEventListener('mousemove', (e) => {
        cursor.style.transform = `translate(${e.clientX - 8}px, ${e.clientY - 8}px)`;
        trailer.style.transform = `translate(${e.clientX - 16}px, ${e.clientY - 16}px)`;
    });

    // Add hover effects for clickable elements
    const clickables = document.querySelectorAll('a, button, .btn');
    clickables.forEach(el => {
        el.addEventListener('mouseenter', () => {
            trailer.style.transform += ' scale(2)';
            trailer.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
            cursor.style.backgroundColor = '#34d399';
        });
        el.addEventListener('mouseleave', () => {
            trailer.style.backgroundColor = 'transparent';
            cursor.style.backgroundColor = '#10b981';
        });
    });
}
