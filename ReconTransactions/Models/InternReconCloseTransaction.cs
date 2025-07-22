using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("Intern_Recon_Close_Transactions")]
public class InternReconCloseTransaction
{
    [Key]
    [StringLength(100)]
    public string RefNumber { get; set; }

    [StringLength(50)]
    public string AccountNumber { get; set; }

    public DateTime Date { get; set; }

    [StringLength(500)]
    public string Narration { get; set; }

    public DateTime ValueDate { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal DebitAmt { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal CreditAmt { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal ClosingBal { get; set; }

    [Column(TypeName = "numeric(18,2)")]
    public decimal Diff_Amt { get; set; }

    [StringLength(50)]
    public string Status { get; set; }

    [StringLength(50)]
    public string BankName { get; set; }

    public bool StatusUpdate { get; set; }

    [StringLength(100)]
    public string CloseBy { get; set; }

    public DateTime CloseOn { get; set; }
}
