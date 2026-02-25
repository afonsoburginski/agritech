import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade - Fox Fieldcore',
  description: 'Política de privacidade do aplicativo Fox Fieldcore (Agritech)',
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="mb-8 text-3xl font-bold">Política de Privacidade</h1>
        <p className="mb-6 text-muted-foreground">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <section className="space-y-6">
          <div>
            <h2 className="mb-2 text-xl font-semibold">1. Responsável</h2>
            <p className="text-muted-foreground">
              Esta política aplica-se ao aplicativo <strong>Fox Fieldcore</strong> (Agritech), destinado a
              monitoramento agrícola de pragas e doenças.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold">2. Dados que coletamos</h2>
            <p className="text-muted-foreground">
              O app utiliza dados necessários ao funcionamento do monitoramento: cadastro de fazendas e talhões,
              registros de escopo (scout), fotos para reconhecimento de pragas/doenças e relatórios gerados.
              Dados de login e perfil são tratados conforme sua conta no serviço.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold">3. Uso da câmera</h2>
            <p className="text-muted-foreground">
              O aplicativo solicita permissão de <strong>câmera</strong> para captura de fotos de plantas e
              pragas/doenças no campo, utilizadas exclusivamente para identificação agronômica e geração de
              relatórios dentro do app. As imagens podem ser processadas por serviços de análise (ex.: reconhecimento
              por IA) para sugerir identificações e recomendações técnicas.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold">4. Armazenamento e segurança</h2>
            <p className="text-muted-foreground">
              Os dados são armazenados em ambiente seguro. Parte das informações pode ficar em cache no dispositivo
              (incluindo banco local) para uso offline e é associada à sua conta.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold">5. Compartilhamento</h2>
            <p className="text-muted-foreground">
              Não vendemos seus dados. O compartilhamento limita-se ao necessário para operação do serviço (ex.:
              hospedagem, análise de imagens) e ao que você optar por compartilhar (ex.: relatórios com sua equipe
              ou fazenda).
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold">6. Contato</h2>
            <p className="text-muted-foreground">
              Para dúvidas sobre esta política ou tratamento de dados, entre em contato pelo canal indicado no
              aplicativo ou no site.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
