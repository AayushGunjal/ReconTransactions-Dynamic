using Microsoft.EntityFrameworkCore;

namespace ReconTransactions.Data
{
    public class YourDbContext : DbContext
    {
        public YourDbContext(DbContextOptions<YourDbContext> options)
            : base(options)
        {
        }

        public DbSet<InternReconTransaction> InternReconTransactions { get; set; }

        public DbSet<InternReconCloseTransaction> InternReconCloseTransactions { get; set; }
    }
}
