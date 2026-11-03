Attribute VB_Name = "Module3"
Sub CopyTableContentsAcrossWorkbooks()
    Dim wbSource As Workbook, wbDest As Workbook
    Dim wsMasterRates As Worksheet, wsRates As Worksheet
    Dim loMasterRates As ListObject, loRates As ListObject
    Dim loMasterRatesFixed As ListObject, loRatesFixed As ListObject
    Dim rMasterRatesRange As Range
    Dim rMasterRatesFixedRange As Range
    Dim sharePointURL As String
    
    ' Open Source worksheet from Sharepoint
    sharePointURL = "https://instramac.sharepoint.com/sites/CostingSheet/Shared%20Documents/General/RATES_MASTER - Copy.xlsm"
        
    ' Check if the MASTER rates link works
    On Error Resume Next
    Set wbSource = Workbooks.Open(sharePointURL)
    If Err.Number <> 0 Then
        MsgBox "The MASTER rates table sharepoint link does not work!" & vbNewLine & sharePointURL, vbExclamation, "Link Error"
        Err.Clear
        Exit Sub
    End If
    
    Set wbDest = ThisWorkbook
    
    Set wsMasterRates = wbSource.Worksheets("RATES REFRESH")
    Set wsRates = wbDest.Worksheets("RATES REFRESH")
    
    Set loMasterRates = wsMasterRates.ListObjects("tblParts")
    Set loRates = wsRates.ListObjects("tblParts")
    
    Set loMasterRatesFixed = wsMasterRates.ListObjects("tblFixed")
    Set loRatesFixed = wsRates.ListObjects("tblFixed")
    
    ' Check if we are not copying a bad copy of the master table
    ' Check if the master rates table is populated
    If loMasterRates.DataBodyRange Is Nothing Then
        MsgBox "Master Rates Table is Empty!", vbExclamation
        Exit Sub
    ElseIf loMasterRatesFixed.DataBodyRange Is Nothing Then
        MsgBox "Fixed Rates Table is Empty!", vbExclamation
        Exit Sub
    End If
    
    ' Set the ranges to copy
    Set rMasterRatesRange = loMasterRates.DataBodyRange
    Set rMasterRatesFixedRange = loMasterRatesFixed.DataBodyRange
    
    ' Turn off screen updating for speed
    'Application.ScreenUpdating = False
    
    ' Clear the existing data
    If Not loRates.DataBodyRange Is Nothing Then
        loRates.AutoFilter.ShowAllData
        loRates.DataBodyRange.Delete
    End If
    
'    If Not loRatesFixed.DataBodyRange Is Nothing Then
'        loRatesFixed.DataBodyRange.Delete
'    End If
    
    Application.DisplayAlerts = False ' Disable alerts to avoid confirmation prompt
    
    ' =====
    ' Rates Table (Equipment etc.)
    ' =====
    ' Resize destination table to match the source size
    ' (Header Row + Number of rows in source data)
    Dim headerRange As Long
    Dim newRangeAddress As String
    headerRow = loRates.HeaderRowRange.Row
    newRangeAddress = loRates.HeaderRowRange.Cells(1, 1).Resize(rMasterRatesRange.Rows.Count + 1, loMasterRates.ListColumns.Count).Address
    
    ' Move the header and tails colour blocks down
    Dim tailInitial As String
    Dim tailEnd As String
    tailInitial = loRates.HeaderRowRange.Offset(2, 0).Resize(10, 50).Address
    tailEnd = wsRates.Range(newRangeAddress).Offset(wsRates.Range(newRangeAddress).Rows.Count, 0).Resize(10, 50).Address
    wsRates.Range(tailInitial).Cut Destination:=wsRates.Range(tailEnd)
    
    ' Resise the destination block
    loRates.Resize wsRates.Range(newRangeAddress)
    
    'Copy the contents from master to rates
    rMasterRatesRange.Copy Destination:=loRates.DataBodyRange.Cells(1, 1)
    Application.CutCopyMode = False
    
    ' =====
    ' Fixed Rates Table (Labour + P&Gs)
    ' =====
    ' Resize destination table to match the source size
    ' (Header Row + Number of rows in source data)
    headerRange = loRatesFixed.HeaderRowRange.Row
    newRangeAddress = loRatesFixed.HeaderRowRange.Cells(1, 1).Resize(rMasterRatesFixedRange.Rows.Count + 1, loMasterRatesFixed.ListColumns.Count).Address
    
    ' Move the header and tails colour blocks down
    tailInitial = loRatesFixed.HeaderRowRange.Offset(2, 0).Resize(3, 50).Address
    tailEnd = wsRates.Range(newRangeAddress).Offset(wsRates.Range(newRangeAddress).Rows.Count, 0).Resize(3, 50).Address
    wsRates.Range(tailInitial).Cut Destination:=wsRates.Range(tailEnd)
    
    ' Resize the destination block
    loRatesFixed.Resize wsRates.Range(newRangeAddress)
    
    'Copy the contents from master to rates
    rMasterRatesFixedRange.Copy Destination:=loRatesFixed.DataBodyRange.Cells(1, 1)
    Application.CutCopyMode = False
    
    ' Clean up
    wbSource.Close
    Application.ScreenUpdating = True
    MsgBox "Rates Table Updated!", vbInformation
End Sub
