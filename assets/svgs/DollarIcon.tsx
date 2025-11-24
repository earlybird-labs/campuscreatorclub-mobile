import * as React from "react"
import Svg, { SvgProps, Path } from "react-native-svg"
const DollarSvg = (props: SvgProps) => (
  <Svg

    width={20}
    height={20}
    fill="none"
    {...props}
  >
    <Path
      fill="#FFA743"
      fillRule="evenodd"
      d="M10 .833a9.167 9.167 0 1 0 0 18.334A9.167 9.167 0 0 0 10 .833Zm.834 3.75a.833.833 0 0 0-1.667 0V5a2.917 2.917 0 0 0 0 5.833h1.667a1.25 1.25 0 1 1 0 2.5H9.027a1.111 1.111 0 0 1-1.111-1.11.833.833 0 1 0-1.667 0A2.778 2.778 0 0 0 9.028 15h.139v.417a.833.833 0 0 0 1.667 0V15a2.917 2.917 0 1 0 0-5.833H9.167a1.25 1.25 0 0 1 0-2.5h1.805c.614 0 1.112.497 1.112 1.11a.833.833 0 1 0 1.666 0A2.778 2.778 0 0 0 10.972 5h-.138v-.417Z"
      clipRule="evenodd"
    />
  </Svg>
)
export default DollarSvg
