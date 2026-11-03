Attribute VB_Name = "Sheet12"
Attribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Attribute VB_TemplateDerived = False
Attribute VB_Customizable = True
Private Sub Worksheet_Deactivate()
    Dim wsTemplates As Worksheet
    Dim wsRates As Worksheet
    Dim loRates As ListObject
    Dim loTemplates As ListObject
    Dim lrTemplatesRow As ListRow
    Dim lrRatesRow As ListRow
    
    Set wsTemplates = ThisWorkbook.Sheets("TEMPLATES LIST")
    Set wsRates = ThisWorkbook.Sheets("RATES REFRESH")
    
    Set loTemplates = wsTemplates.ListObjects("tblTemplateList")
    Set loRates = wsRates.ListObjects("tblParts")
    
    ' First checks if the row already exists in the table
    For Each lrTemplatesRow In loTemplates.ListRows
        Dim bFound As Boolean
        bFound = False
        For Each lrRatesRow In loRates.ListRows
            If (lrTemplatesRow.Range(5).Value = lrRatesRow.Range(2).Value) Then
                bFound = True
                Exit For
            End If
        Next lrRatesRow
        ' If the template name was found, update its information
        If bFound Then
            If Not (lrTemplatesRow.Range(6) = lrRatesRow.Range(8)) Then
                lrRatesRow.Range(8).Value = lrTemplatesRow.Range(6).Value
            End If
        ' If the template name was not found, add it to the list
        Else
            Dim newRow As ListRow
            Set newRow = loRates.ListRows.Add
            
            ' New row information update
            ' Range(1) - Part Number
            ' Range(2) - Description
            ' Range(3) - Supplier
            ' Range(4) - OEM
            ' Range(5) - Category 1
            ' Range(6) - Category 2
            ' Range(7) - Category 3
            ' Range(8) - List Price
            ' Range(9) - Discount
            ' Range(10) - Cost Category
            ' Range(11) - Standard Leadtime
            ' Range(12) - Last Updated
            ' The rest we don't need
            
            ' This is all we need to know (for now)
            newRow.Range(1).Value = lrTemplatesRow.Range(8).Text
            newRow.Range(2).Value = lrTemplatesRow.Range(8).Text
            newRow.Range(3).Value = "CGI"
            newRow.Range(4).Value = "Various"
            newRow.Range(5).Value = "Templates"
            newRow.Range(8).Value = lrTemlplatesRow.Range(9).Text
        End If
    Next
        
    

    'Dim wbSource, wbDest As Workbook
    'Dim wsRates, wsMaster As Worksheet
    'Dim loRates As ListObject
    'Dim loMasterRates As ListObject
    'Dim loFixedRates As ListObject
    'Dim loMasterFixedRates As ListObject
    'Dim loRatesFixed, loMasterRatesFixed As ListObject
    'Dim sharePointURL As String
    
    ' Open Source worksheet from Sharepoint
    'sharePointURL = "https://instramac.sharepoint.com/sites/CostingSheet/Shared%20Documents/General/RATES_MASTER - Copy.xlsm"
        
    ' Check if the MASTER rates link works
    'On Error Resume Next
    'Set wbDest = Workbooks.Open(sharePointURL)
    'If Err.Number <> 0 Then
    '    MsgBox "The MASTER rates table sharepoint link does not work!", vbExclamation, "Link Error"
    '    Err.Clear
    '    Exit Sub
    'End If
    '
    'Set wbSource = ThisWorkbook
    '
    ' Set the source and destination worksheets
    'Set wsMaster = wbDest.Sheets("RATES REFRESH")
    'Set wsRates = wbSource.Sheets("RATES REFRESH")
   
    ' Set the source and destination listobjects
    'Set loMasterRates = wsMaster.ListObjects("tblParts")
    'Set loRates = wsRates.ListObjects("tblParts")
    
    ' Set the source and destination listobjects
    'Set loMasterFixedRates = wsMaster.ListObjects("tblFixed")
    'Set loFixedRates = wsRates.ListObjects("tblFixed")
    
    ' Update equipment rates table
    'UpdateMasterTable loRates, loMasterRates
    
    ' Update fixed rates table
    'UpdateMasterTable loFixedRates, loMasterFixedRates
End Sub

