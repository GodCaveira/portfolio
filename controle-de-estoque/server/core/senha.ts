import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// scrypt com N=2^15, r=8, p=3: uma das combinações mínimas da OWASP (cerca de 32 MiB por cálculo).
// Vem do próprio Node, sem dependência nativa extra na imagem.
const N = 2 ** 15
const R = 8
const P = 3
const TAMANHO = 32

function derivar(senha: string, sal: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha.normalize('NFKC'), sal, TAMANHO, { N: n, r, p, maxmem: 256 * n * r }, (erro, chave) =>
      erro ? reject(erro) : resolve(chave),
    )
  })
}

// Formato: scrypt$N$r$p$sal$hash (base64url). Os parâmetros ficam no hash para poderem subir depois.
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16)
  const hash = await derivar(senha, sal, N, R, P)
  return ['scrypt', N, R, P, sal.toString('base64url'), hash.toString('base64url')].join('$')
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false
  const [, n, r, p, sal, hash] = partes as [string, string, string, string, string, string]
  const esperado = Buffer.from(hash, 'base64url')
  const obtido = await derivar(senha, Buffer.from(sal, 'base64url'), Number(n), Number(r), Number(p))
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado)
}

// Usado quando o e-mail não existe: gasta o mesmo tempo de uma verificação real,
// para a resposta não revelar quais e-mails têm conta.
let hashFicticio: Promise<string> | undefined
export async function verificarSenhaFicticia(senha: string): Promise<false> {
  hashFicticio ??= gerarHashSenha(randomBytes(16).toString('hex'))
  await verificarSenha(senha, await hashFicticio)
  return false
}
