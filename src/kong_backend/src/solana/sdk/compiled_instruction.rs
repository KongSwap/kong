#[derive(Debug, PartialEq, Eq, Clone)]
pub struct CompiledInstruction {
    /// Index into the transaction keys array indicating the program account that executes this instruction.
    pub program_id_index: u8,

    /// Ordered indices into the transaction keys array indicating which accounts to pass to the program.
    pub accounts: Vec<u8>,

    /// The program input data.
    pub data: Vec<u8>,
}
