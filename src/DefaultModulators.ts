import { ModulatorList } from "./Structs.ts";
import { ModulatorSource } from "./Modulator.ts";

export const DefaultModulators = [
  new ModulatorList(
    ModulatorSource.parse(0x0502),
    48,
    960,
    ModulatorSource.parse(0x0),
    0,
  ),
  new ModulatorList(
    ModulatorSource.parse(0x0102),
    8,
    -2400,
    ModulatorSource.parse(0x0),
    0,
  ),
  new ModulatorList(
    ModulatorSource.parse(0x000d),
    6,
    50,
    ModulatorSource.parse(0x0),
    0,
  ),
  new ModulatorList(
    ModulatorSource.parse(0x0081),
    6,
    50,
    ModulatorSource.parse(0x0),
    0,
  ),
  new ModulatorList(
    ModulatorSource.parse(0x0587),
    48,
    960,
    ModulatorSource.parse(0x0),
    0,
  ), // specification is wrong
  new ModulatorList(
    ModulatorSource.parse(0x028a),
    48,
    1000,
    ModulatorSource.parse(0x0),
    0,
  ),
  new ModulatorList(
    ModulatorSource.parse(0x058b),
    48,
    960,
    ModulatorSource.parse(0x0),
    0,
  ),
  new ModulatorList(
    ModulatorSource.parse(0x00db),
    16,
    200,
    ModulatorSource.parse(0x0),
    0,
  ),
  new ModulatorList(
    ModulatorSource.parse(0x00dd),
    15,
    200,
    ModulatorSource.parse(0x0),
    0,
  ),
  new ModulatorList(
    ModulatorSource.parse(0x020e),
    52,
    12700,
    ModulatorSource.parse(0x0010),
    0,
  ),
];
