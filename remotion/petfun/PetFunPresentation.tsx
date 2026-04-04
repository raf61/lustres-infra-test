import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill } from "remotion";
import { Cover } from "./Cover";
import { Scene00Intro } from "./Scene00Intro";
import { Scene01Market, SCENE01_DURATION } from "./Scene01Market";
import { SectionTitle } from "./SectionTitle";
import { CapabilitySlide } from "./CapabilitySlide";
import { ProcessSlide } from "./ProcessSlide";
import { Closing } from "./Closing";
import {
  IlluReativacao,
  IlluAtendimento,
  IlluAgendamento,
  IlluGestor,
  IlluVisibilidade,
  IlluERP,
  IlluCRM,
} from "./illustrations";
import React from "react";

const TR = 18;
const timing = springTiming({ durationInFrames: TR, config: { damping: 200 } });
const t = { presentation: fade(), timing };

const COVER   = 100;
const INTRO   = 72;
const SEC     = 65;
const STEP    = 60;
const LAST_STEP = 80; // último step tem pausa maior antes de mudar de seção
const POSS    = 95;   // slide mais longo → sinaliza nova seção
const CAP     = 88;
const PROC    = 90;
const CLOSING = 110;

// 24 slides → 23 transitions
const N_TR = 23;

export const TOTAL_DURATION =
  COVER + INTRO + SCENE01_DURATION +
  SEC * 2 +
  STEP * 4 + LAST_STEP +
  POSS +
  CAP * 7 +
  SEC * 2 +
  PROC * 3 +
  CLOSING -
  N_TR * TR;

export function PetFunPresentation() {
  return (
    <AbsoluteFill>
      <TransitionSeries>

        {/* ── 01 · Abertura ── */}
        <TransitionSeries.Sequence durationInFrames={COVER} premountFor={TR}>
          <Cover />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 02 · Setup do problema ── */}
        <TransitionSeries.Sequence durationInFrames={INTRO} premountFor={TR}>
          <Scene00Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 03 · Os 3 problemas do mercado ── */}
        <TransitionSeries.Sequence durationInFrames={SCENE01_DURATION} premountFor={TR}>
          <Scene01Market />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 04 · Pivô ── */}
        <TransitionSeries.Sequence durationInFrames={SEC} premountFor={TR}>
          <SectionTitle title="Existe uma forma diferente de fazer isso." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 05 · Nossa proposta ── */}
        <TransitionSeries.Sequence durationInFrames={SEC} premountFor={TR}>
          <SectionTitle title="Nossa solução é feita sob medida para a Pet Fun." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 06–10 · Como implementamos ── */}
        <TransitionSeries.Sequence durationInFrames={STEP} premountFor={TR}>
          <SectionTitle label="01" title="Primeiro: diagnóstico completo da operação." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={STEP} premountFor={TR}>
          <SectionTitle label="02" title="Desenvolvemos uma solução 100% para a Pet Fun." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={STEP} premountFor={TR}>
          <SectionTitle label="03" title="Integramos com a base de dados e o ERP de vocês." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={STEP} premountFor={TR}>
          <SectionTitle label="04" title="Treinamos todas as pessoas que vão operar o sistema." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={LAST_STEP} premountFor={TR}>
          <SectionTitle label="05" title="Suporte contínuo para alterações e melhorias." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 11 · Divisor de seção (pausa) ── */}
        <TransitionSeries.Sequence durationInFrames={POSS} premountFor={TR}>
          <SectionTitle title="Possibilidades de aplicação de I.A na Pet Fun." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 12–18 · Capabilities ── */}
        <TransitionSeries.Sequence durationInFrames={CAP} premountFor={TR}>
          <CapabilitySlide num="01" title="Reativação de base de clientes"
            illustration={<IlluReativacao />} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={CAP} premountFor={TR}>
          <CapabilitySlide num="02" title="I.A para atendimento e venda no WhatsApp"
            illustration={<IlluAtendimento />} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={CAP} premountFor={TR}>
          <CapabilitySlide num="03" title="Agendamento automático de banho e tosa"
            illustration={<IlluAgendamento />} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={CAP} premountFor={TR}>
          <CapabilitySlide num="04" title="I.A com conhecimento da empresa"
            illustration={<IlluGestor />} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={CAP} premountFor={TR}>
          <CapabilitySlide num="05" title="Dashboards para visibilidade total"
            illustration={<IlluVisibilidade />} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={CAP} premountFor={TR}>
          <CapabilitySlide num="06" title="Integração com o ERP"
            illustration={<IlluERP />} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={CAP} premountFor={TR}>
          <CapabilitySlide num="07" title="Organização de leads com I.A no CRM"
            illustration={<IlluCRM />} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 19–20 · Contexto ── */}
        <TransitionSeries.Sequence durationInFrames={SEC} premountFor={TR}>
          <SectionTitle title="Essas aplicações são apenas possibilidades." />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={SEC} premountFor={TR}>
          <SectionTitle
            title="Nossa diferença é entrar na empresa e descobrir o que faz sentido para vocês."
            titleColor="rgba(74,222,128,0.9)"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 21–23 · Processo ── */}
        <TransitionSeries.Sequence durationInFrames={PROC} premountFor={TR}>
          <ProcessSlide
            num="01 · Diagnóstico"
            title="Entendemos o negócio."
            body={"Mapeamos toda a operação da Pet Fun antes de desenvolver qualquer coisa.\nO resultado é uma solução construída especificamente para vocês."}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={PROC} premountFor={TR}>
          <ProcessSlide
            num="02 · Implantação"
            title="Colocamos tudo em funcionamento."
            body={"Desenvolvemos, integramos ao ERP e treinamos a equipe.\nSua operação começa a funcionar com I.A sem interromper o dia a dia."}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        <TransitionSeries.Sequence durationInFrames={PROC} premountFor={TR}>
          <ProcessSlide
            num="03 · Acompanhamento"
            title="Continuamos ao lado."
            body={"Monitoramos os resultados, ajustamos o que for necessário\ne evoluímos a solução junto com o crescimento da Pet Fun."}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...t} />

        {/* ── 24 · Fechamento ── */}
        <TransitionSeries.Sequence durationInFrames={CLOSING} premountFor={TR}>
          <Closing />
        </TransitionSeries.Sequence>

      </TransitionSeries>
    </AbsoluteFill>
  );
}
