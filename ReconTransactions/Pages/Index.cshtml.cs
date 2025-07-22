using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ReconTransactions.Data;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;

namespace ReconTransactions.Pages
{
    public class BankReconModel : PageModel
    {
        private readonly YourDbContext _dbContext;
        private readonly ILogger<BankReconModel> _logger;

        static readonly Dictionary<string, List<string>> _accountCache = new();

        public BankReconModel(YourDbContext dbContext, ILogger<BankReconModel> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        [BindProperty] public BankReconView Input { get; set; } = new();
        public List<string> BankNames { get; set; } = new() { "HDFC", "ICICI" };
        public List<string> AccountNumbers { get; set; } = new();

        public void OnGet() { }

        [IgnoreAntiforgeryToken]
        public IActionResult OnGetAccountNumbers(string bankName)
        {
            AccountNumbers.Clear();

            try
            {
                if (string.IsNullOrWhiteSpace(bankName))
                {
                    _logger.LogWarning("BankName was empty in GetAccountNumbers.");
                    return new JsonResult(new List<string>());
                }

                if (_accountCache.TryGetValue(bankName, out var cachedAccounts))
                {
                    _logger.LogInformation($"Returning cached accounts for {bankName}");
                    return new JsonResult(cachedAccounts);
                }

                var accounts = _dbContext.InternReconTransactions
                    .AsNoTracking()
                    .Where(x => x.BankName == bankName)
                    .Select(x => x.AccountNumber)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToList();

                _accountCache[bankName] = accounts;
                _logger.LogInformation($"Loaded {accounts.Count} accounts for {bankName}");
                return new JsonResult(accounts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in OnGetAccountNumbers");
                return new JsonResult(new List<string>());
            }
        }

        [IgnoreAntiforgeryToken]
        public IActionResult OnGetReconData(string bankName, string accountNumber, string fromDate, string toDate)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(bankName) || string.IsNullOrWhiteSpace(accountNumber)
                    || string.IsNullOrWhiteSpace(fromDate) || string.IsNullOrWhiteSpace(toDate))
                {
                    _logger.LogWarning("One or more parameters are null or empty in GetReconData.");
                    return new JsonResult(new { columns = new List<object>(), data = new List<object>() });
                }

                if (!DateTime.TryParse(fromDate, out var dtFrom) || !DateTime.TryParse(toDate, out var dtTo))
                {
                    _logger.LogWarning("Invalid date format provided.");
                    return new JsonResult(new { columns = new List<object>(), data = new List<object>() });
                }

                if (dtFrom > dtTo)
                {
                    _logger.LogWarning("Invalid date range: FromDate is after ToDate.");
                    return new JsonResult(new { columns = new List<object>(), data = new List<object>() });
                }

                var dataList = _dbContext.InternReconTransactions
                    .AsNoTracking()
                    .Where(x => x.BankName == bankName &&
                                x.AccountNumber == accountNumber &&
                                x.Date >= dtFrom &&
                                x.Date <= dtTo)
                    .OrderBy(x => x.Date)
                    .ToList();

                // Build DataTable for dynamic columns
                var dt = new DataTable();
                if (dataList.Count > 0)
                {
                    foreach (var prop in dataList[0].GetType().GetProperties())
                        dt.Columns.Add(prop.Name, Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType);

                    foreach (var item in dataList)
                        dt.Rows.Add(item.GetType().GetProperties().Select(p => p.GetValue(item, null)).ToArray());
                }

                // Build columns for Tabulator
                var columns = dt.Columns
                    .Cast<DataColumn>()
                    .Select(col => new
                    {
                        title = ToTitleCase(col.ColumnName),
                        field = col.ColumnName,
                        headerSort = false
                    }).ToList();

                // Build data for Tabulator
                var data = dt.AsEnumerable()
                    .Select(row => dt.Columns.Cast<DataColumn>()
                        .ToDictionary(col => col.ColumnName, col => row[col.ColumnName]))
                    .ToList();

                _logger.LogInformation($"Found {data.Count} records for {bankName} / {accountNumber}");
                return new JsonResult(new { columns, data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in OnGetReconData");
                return new JsonResult(new { columns = new List<object>(), data = new List<object>() });
            }
        }

        private static string ToTitleCase(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            // Convert PascalCase or camelCase to "Pascal Case"
            var result = System.Text.RegularExpressions.Regex.Replace(
                input, "([a-z])([A-Z])", "$1 $2");
            return System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(result);
        }
    }

    public class BankReconView
    {
        public string BankName { get; set; } = string.Empty;
        public string AccountNumber { get; set; } = string.Empty;
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
    }
}
