Attribute VB_Name = "modUpdateRatesTable"
Public Sub UpdateRates()
    Dim Confirmation As VbMsgBoxResult
    
    Confirmation = MsgBox("This will replace your current RATES table with the Master RATES table, are you sure you want to continue?", vbYesNo + vbQuestion, "Confirmation")
    
    If Confirmation = vbYes Then

        Dim wbSource As Workbook
        Dim wsSource As Worksheet
        Dim wsDest As Worksheet
        Dim wsReference As Worksheet
        Dim sharePointURL As String
        Dim definedName As Name
        Dim rngToUpdate As Range
        Dim lastRow As Long
        Dim updateCondition As FormatCondition
        Dim lastRowCount As Long
        Dim lastColCount As Long
        Dim copyAddress As String
        
        ' Open Source worksheet from Sharepoint
        sharePointURL = "https://instramac.sharepoint.com/sites/CostingSheet/Shared%20Documents/General/RATES_MASTER - Copy.xlsm"
        
        ' Check if the MASTER rates link works
        On Error Resume Next
        Set wbSource = Workbooks.Open(sharePointURL)
        If Err.Number <> 0 Then
            MsgBox "The MASTER rates table sharepoint link does not work!", vbExclamation, "Link Error"
            Err.Clear
            Exit Sub
        End If
        
        ' Set the source and destination worksheets
        Set wsSource = wbSource.Sheets("RATES REFRESH")
        Set wsDest = ThisWorkbook.Sheets("RATES REFRESH")
        
        Application.DisplayAlerts = False ' Disable alerts to avoid confirmation prompt
        
        ' Create a copy block
        lastRowCount = wsSource.UsedRange.Rows.Count
        lastColCount = 100
        copyAddress = wsSource.Range("A1").Resize(lastRowCount, lastColCount).Address
        
        ' Clear the old rates sheet
        wsDest.Cells.Clear
        
        ' Copy the new RATES data
        wsSource.Range(copyAddress).Copy Destination:=wsDest.Range(copyAddress)
        Application.CutCopyMode = False
        
        Application.DisplayAlerts = True ' Re-enable alerts
        Application.Calculation = xlCalculationAutomatic
        
        ' Close the old worksheet
        'wbSource.Close
    Else
        Exit Sub
    End If
End Sub


