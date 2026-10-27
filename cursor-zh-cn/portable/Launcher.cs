using System;
using System.IO;
using System.Management.Automation;
using System.Management.Automation.Runspaces;
using System.Threading;
using System.Windows.Forms;

internal static class CursorZhCNTool
{
    [STAThread]
    private static void Main()
    {
        try
        {
            string script = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "CursorZhCN.ps1");
            if (!File.Exists(script)) throw new FileNotFoundException("Please extract the complete portable package before running.", script);
            InitialSessionState initial = InitialSessionState.CreateDefault();
            initial.ExecutionPolicy = Microsoft.PowerShell.ExecutionPolicy.Bypass;
            using (Runspace runspace = RunspaceFactory.CreateRunspace(initial))
            {
                runspace.ApartmentState = ApartmentState.STA;
                runspace.ThreadOptions = PSThreadOptions.ReuseThread;
                runspace.Open();
                using (PowerShell powershell = PowerShell.Create())
                {
                    powershell.Runspace = runspace;
                    powershell.AddCommand(script);
                    powershell.Invoke();
                    if (powershell.InvocationStateInfo.State == PSInvocationState.Failed)
                        throw powershell.InvocationStateInfo.Reason;
                }
            }
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Cursor \u4e2d\u6587\u6ce8\u5165\u5de5\u5177", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
