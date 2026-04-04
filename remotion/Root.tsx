import { Composition } from "remotion";
import { PetFunPresentation, TOTAL_DURATION } from "./petfun/PetFunPresentation";

export const RemotionRoot = () => {
  return (
    <Composition
      id="PetFun-Apresentacao"
      component={PetFunPresentation}
      durationInFrames={TOTAL_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
