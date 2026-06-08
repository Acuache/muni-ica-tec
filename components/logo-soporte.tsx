import Image from 'next/image'
import Link from 'next/link'
import logo from '@/assets/muni-ica.png'

type Props = {
  href: string
}

export default function LogoSoporte({ href }: Props) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <div className="flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white p-1">
        <Image
          src={logo}
          alt="Municipalidad Provincial de Ica"
          width={32}
          height={32}
          className="h-full w-full object-contain"
        />
      </div>
      <span className="text-base font-semibold text-blue-700">
        Soporte Municipal
      </span>
    </Link>
  )
}
