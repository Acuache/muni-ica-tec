// La raíz nunca se renderiza para el usuario: proxy.ts redirige siempre
// a /login (sin sesión) o al panel del rol correspondiente (con sesión).
export default function Home() {
  return null;
}
